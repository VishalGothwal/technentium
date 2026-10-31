import "server-only";
import type { JobStatus } from "@/generated/prisma/enums";
import { audit } from "@/server/audit";
import { db, type Tx } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { dispatchAfterCommit, enqueue } from "@/server/notifications/outbox";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { getSetting } from "@/server/settings";
import { parse } from "@/server/validation";
import { quoteDecisionSchema, quoteDraftSchema } from "@/lib/schemas/repair";
import { formatDate, formatPaise } from "@/lib/format";
import { applyJobTransition, JOB_TRANSITION_SELECT } from "@/server/modules/repairs/transition";
import { returnChargeFor } from "@/server/modules/repairs/return.service";
import { computeTotals } from "./money";

/** Job states from which staff may open a (new) draft. IN_PROGRESS covers "additional work found". */
const DRAFTABLE: readonly JobStatus[] = ["INSPECTION", "QUOTE_PREPARED", "AWAITING_DECISION", "AWAITING_CUSTOMER_RESPONSE", "IN_PROGRESS"];

/**
 * Return the job's editable draft, creating one if needed. Creating a draft while a version is
 * SENT supersedes it — the customer can no longer act on it and must approve the new version
 * (FR-QUOTE-05/08). History is never overwritten.
 */
export async function openDraft(actor: Actor | null, jobId: string) {
  assertCan(actor, "quote.manage");
  const job = await db.repairJob.findUnique({
    where: { id: jobId },
    select: { ...JOB_TRANSITION_SELECT, booking: { select: { customerId: true, diagnosisFeePaise: true, feeWaivedIfApproved: true } } },
  });
  if (!job) throw notFound("job");
  if (!DRAFTABLE.includes(job.status)) throw new AppError("INVALID_TRANSITION", "errors.quote.notDraftable");

  return db.$transaction(async (tx) => {
    const quote = await tx.quote.upsert({ where: { jobId }, create: { jobId }, update: {}, include: { activeVersion: { include: { lineItems: true } } } });
    const current = quote.activeVersion;
    if (current?.status === "DRAFT") return current.id;

    const lastNumber = await tx.quoteVersion.aggregate({ where: { quoteId: quote.id }, _max: { number: true } });
    const taxRateBps = await getSetting("tax.gstRateBps", tx);
    const carried = current?.lineItems ?? [];
    const initialLines =
      carried.length > 0
        ? carried.map(({ kind, description, quantity, unitPaise, taxable, priceItemId, partGrade, compatibilityNote, sortOrder }) => ({
            kind, description, quantity, unitPaise, taxable, priceItemId, partGrade, compatibilityNote, sortOrder,
          }))
        : !job.booking.feeWaivedIfApproved && job.booking.diagnosisFeePaise > 0
          ? [{ kind: "DIAGNOSIS_FEE" as const, description: "Diagnosis fee", quantity: 1, unitPaise: job.booking.diagnosisFeePaise, taxable: true, sortOrder: 0 }]
          : [];
    const totals = computeTotals(initialLines, taxRateBps);

    const version = await tx.quoteVersion.create({
      data: {
        quoteId: quote.id,
        number: (lastNumber._max.number ?? 0) + 1,
        createdById: actor.userId,
        taxRateBps,
        customerMessage: current?.customerMessage ?? null,
        ...totals,
        lineItems: { create: initialLines },
      },
    });

    if (current?.status === "SENT") {
      await tx.quoteVersion.update({ where: { id: current.id }, data: { status: "SUPERSEDED" } });
    }
    await tx.quote.update({ where: { id: quote.id }, data: { activeVersionId: version.id } });

    if (job.status !== "QUOTE_PREPARED") {
      await applyJobTransition(tx, actor, job, "QUOTE_PREPARED", { system: true, reason: current ? `Quote revised (v${version.number})` : null });
    }
    await audit(tx, actor, { action: current ? "quote.revise" : "quote.create", entityType: "RepairJob", entityId: jobId, after: { versionId: version.id, number: version.number } });
    return version.id;
  });
}

/** Replace the draft's lines. Totals are recomputed on the server from the lines (FR-QUOTE-04). */
export async function saveDraft(actor: Actor | null, versionId: string, raw: unknown) {
  assertCan(actor, "quote.manage");
  const input = parse(quoteDraftSchema, raw);
  const version = await db.quoteVersion.findUnique({ where: { id: versionId }, select: { id: true, status: true, taxRateBps: true, quote: { select: { jobId: true } } } });
  if (!version) throw notFound("quote");
  if (version.status !== "DRAFT") throw new AppError("QUOTE_NOT_ACTIONABLE", "errors.quote.notDraft");

  let totals;
  try {
    totals = computeTotals(input.lines.map((l) => ({ kind: l.kind, quantity: l.quantity, unitPaise: l.unitPaise, taxable: l.taxable })), version.taxRateBps);
  } catch {
    throw new AppError("VALIDATION", "errors.quote.discountTooLarge");
  }

  await db.$transaction(async (tx) => {
    await tx.quoteLineItem.deleteMany({ where: { versionId } });
    await tx.quoteLineItem.createMany({
      data: input.lines.map((l, i) => ({
        versionId,
        kind: l.kind,
        description: l.description,
        quantity: l.quantity,
        unitPaise: l.unitPaise,
        taxable: l.taxable,
        priceItemId: l.priceItemId ?? null,
        partGrade: l.partGrade ?? null,
        compatibilityNote: l.compatibilityNote ?? null,
        sortOrder: i,
      })),
    });
    await tx.quoteVersion.update({ where: { id: versionId }, data: { ...totals, customerMessage: input.customerMessage || null } });
    await audit(tx, actor, { action: "quote.save_draft", entityType: "RepairJob", entityId: version.quote.jobId, after: { versionId, totals, lines: input.lines.length } });
  });
  return totals;
}

export async function sendQuote(actor: Actor | null, versionId: string) {
  assertCan(actor, "quote.manage");
  const version = await db.quoteVersion.findUnique({
    where: { id: versionId },
    include: { lineItems: true, quote: { include: { job: { select: JOB_TRANSITION_SELECT } } } },
  });
  if (!version) throw notFound("quote");
  if (version.status !== "DRAFT" || version.quote.activeVersionId !== version.id) throw new AppError("QUOTE_NOT_ACTIONABLE", "errors.quote.notDraft");
  if (version.lineItems.length === 0) throw new AppError("VALIDATION", "errors.quote.empty");

  const diagnosis = await db.repairDiagnosis.findUnique({ where: { jobId: version.quote.jobId }, select: { id: true } });
  if (!diagnosis) throw new AppError("VALIDATION", "errors.quote.needsDiagnosis");

  const expiryDays = await getSetting("quote.expiryDays");
  const sentAt = new Date();
  const expiresAt = new Date(sentAt.getTime() + expiryDays * 86_400_000);

  const eventId = await db.$transaction(async (tx) => {
    const updated = await tx.quoteVersion.updateMany({ where: { id: versionId, status: "DRAFT" }, data: { status: "SENT", sentAt, sentById: actor.userId, expiresAt } });
    if (updated.count !== 1) throw new AppError("CONFLICT", "errors.conflict.stale");
    await audit(tx, actor, { action: "quote.send", entityType: "RepairJob", entityId: version.quote.jobId, after: { versionId, totalPaise: version.totalPaise, expiresAt } });
    return applyJobTransition(tx, actor, version.quote.job, "AWAITING_DECISION", {
      system: true,
      notifyParams: { total: formatPaise(version.totalPaise), expires: formatDate(expiresAt) },
    });
  });
  dispatchAfterCommit([eventId]);
}

/**
 * Customer decision on the active quote (FR-QUOTE-06/07/12/13). Only the active, sent, unexpired
 * version is actionable. Replaying the same decision is a no-op; a conflicting one is rejected.
 * Declining records the return method and the charge shown to the customer.
 */
export async function decideQuote(actor: Actor | null, versionId: string, raw: unknown) {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
  const input = parse(quoteDecisionSchema, raw);

  const version = await db.quoteVersion.findUnique({
    where: { id: versionId },
    include: { decision: true, quote: { include: { job: { select: { ...JOB_TRANSITION_SELECT, booking: { select: { customerId: true, diagnosisFeePaise: true } } } } } } },
  });
  // Another customer's quote is indistinguishable from a missing one.
  if (!version || version.quote.job.booking.customerId !== actor.userId) throw notFound("quote");

  if (version.decision) {
    if (version.decision.decision === input.decision) return { status: version.status, replay: true };
    throw new AppError("QUOTE_NOT_ACTIONABLE", "errors.quote.alreadyDecided");
  }
  if (version.quote.activeVersionId !== version.id || version.status !== "SENT") throw new AppError("QUOTE_NOT_ACTIONABLE", "errors.quote.superseded");
  if (version.expiresAt && version.expiresAt <= new Date()) throw new AppError("QUOTE_NOT_ACTIONABLE", "errors.quote.expired");

  const job = version.quote.job;
  const returnCharge = input.decision === "DECLINED" ? await returnChargeFor(input.returnMethod) : 0;

  const eventIds = await db.$transaction(async (tx) => {
    const updated = await tx.quoteVersion.updateMany({ where: { id: versionId, status: "SENT" }, data: { status: input.decision } });
    if (updated.count !== 1) throw new AppError("CONFLICT", "errors.conflict.stale");
    await tx.quoteDecision.create({
      data: {
        versionId,
        decision: input.decision,
        customerId: actor.userId,
        reason: input.decision === "DECLINED" ? input.reason || null : null,
        ipAddress: actor.ipAddress ?? null,
        userAgent: actor.userAgent?.slice(0, 300) ?? null,
      },
    });
    await audit(tx, actor, { action: `quote.${input.decision.toLowerCase()}`, entityType: "RepairJob", entityId: job.id, after: { versionId, number: version.number, totalPaise: version.totalPaise } });

    if (input.decision === "APPROVED") {
      return [await applyJobTransition(tx, actor, job, "APPROVED", { system: true })];
    }

    const first = await applyJobTransition(tx, actor, job, "QUOTE_DECLINED", { system: true, reason: input.reason || null });
    await tx.repairReturn.create({
      data: {
        jobId: job.id,
        reason: "QUOTE_DECLINED",
        method: input.returnMethod,
        chargePaise: returnCharge,
        acceptedAt: new Date(),
        addressLine1: input.address?.addressLine1 ?? null,
        addressLine2: input.address?.addressLine2 || null,
        pincode: input.address?.pincode ?? null,
      },
    });
    await applyJobTransition(tx, actor, { ...job, status: "QUOTE_DECLINED" }, "RETURN_COORDINATION", { system: true });
    return [first];
  });
  dispatchAfterCommit(eventIds);
  return { status: input.decision, replay: false };
}

/** Charges a customer sees before confirming a decline (FR-QUOTE-13, D-08). */
export async function declineCharges(diagnosisFeePaise: number) {
  const [collection, delivery] = await Promise.all([returnChargeFor("COLLECTION"), returnChargeFor("DELIVERY")]);
  return { diagnosisFeePaise, collectionPaise: collection, deliveryPaise: delivery };
}

/**
 * Cron: send reminders before expiry, then expire unanswered quotes and flag the job for staff
 * follow-up (D-07). Idempotent: reminderSentAt and the SENT→EXPIRED compare-and-set guard reruns.
 */
export async function processQuoteExpiry(now = new Date()) {
  const reminderDays = await getSetting("quote.reminderDaysBeforeExpiry");
  const eventIds: (string | null)[] = [];

  const toRemind = await db.quoteVersion.findMany({
    where: { status: "SENT", reminderSentAt: null, expiresAt: { gt: now, lte: new Date(now.getTime() + reminderDays * 86_400_000) } },
    include: { quote: { include: { job: { select: { id: true, reference: true, booking: { select: { customerId: true } } } } } } },
  });
  for (const v of toRemind) {
    eventIds.push(
      await db.$transaction(async (tx: Tx) => {
        const claimed = await tx.quoteVersion.updateMany({ where: { id: v.id, reminderSentAt: null }, data: { reminderSentAt: now } });
        if (claimed.count !== 1) return null;
        return enqueue(tx, {
          type: "quote.reminder",
          recipientId: v.quote.job.booking.customerId,
          dedupeKey: `quote:${v.id}:reminder`,
          params: { reference: v.quote.job.reference, expires: formatDate(v.expiresAt!) },
          href: `/account/bookings/${v.quote.job.reference}`,
        });
      }),
    );
  }

  const expired = await db.quoteVersion.findMany({
    where: { status: "SENT", expiresAt: { lte: now } },
    include: { quote: { include: { job: { select: JOB_TRANSITION_SELECT } } } },
  });
  for (const v of expired) {
    eventIds.push(
      await db.$transaction(async (tx: Tx) => {
        const claimed = await tx.quoteVersion.updateMany({ where: { id: v.id, status: "SENT" }, data: { status: "EXPIRED" } });
        if (claimed.count !== 1) return null;
        await audit(tx, null, { action: "quote.expire", entityType: "RepairJob", entityId: v.quote.jobId, after: { versionId: v.id } });
        if (v.quote.job.status !== "AWAITING_DECISION") return null;
        return applyJobTransition(tx, null, v.quote.job, "AWAITING_CUSTOMER_RESPONSE", { system: true, reason: "Quote expired without a decision" });
      }),
    );
  }

  dispatchAfterCommit(eventIds);
  return { reminded: toRemind.length, expired: expired.length, eventIds: eventIds.filter(Boolean) as string[] };
}

export async function listPriceItems(jobId: string) {
  const job = await db.repairJob.findUnique({ where: { id: jobId }, select: { booking: { select: { modelId: true, issues: { select: { issueTypeId: true } } } } } });
  if (!job) return [];
  const issueIds = job.booking.issues.map((i) => i.issueTypeId);
  return db.priceItem.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ modelId: null }, { modelId: job.booking.modelId }] },
        { OR: [{ issueTypeId: null }, { issueTypeId: { in: issueIds } }] },
      ],
    },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
}
