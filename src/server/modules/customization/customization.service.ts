import "server-only";
import { assertSection } from "@/server/features";
import type { CustomizationStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db, type Tx } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { dispatchAfterCommit, enqueue } from "@/server/notifications/outbox";
import { enforce } from "@/server/rate-limit";
import { assertCan, can, type Actor } from "@/server/rbac/actor";
import { parse } from "@/server/validation";
import { createT } from "@/i18n/translate";
import { isLocale } from "@/i18n/config";
import { formatPaise } from "@/lib/format";
import type { CustomizationConfig } from "@/lib/customization/config";
import { estimatePaise } from "@/lib/customization/pricing";
import { CUSTOMIZABLE_CATEGORIES, readStyle, type DeviceKind } from "@/lib/customization/style";
import { readHiddenSteps, visibleSteps } from "@/lib/customization/steps";
import { getSetting } from "@/server/settings";
import {
  customizationCancelSchema,
  customizationDecisionSchema,
  customizationNextStepsSchema,
  customizationNoteSchema,
  customizationQuoteSchema,
  customizationReplySchema,
  customizationRequestSchema,
  customizationTransitionSchema,
} from "@/lib/schemas/customization";
import { CUSTOMIZATION_TONE, findCustomizationRule, type CustomizationRule } from "./state";

function requireUser(actor: Actor | null): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
}

async function nextReference(tx: Tx): Promise<string> {
  const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('customization_request_ref_seq')`;
  const yymm = new Date().toISOString().slice(2, 7).replace("-", "");
  return `TN-C-${yymm}-${String(nextval).padStart(5, "0")}`;
}

// ───────────────────────────── Public catalogue ─────────────────────────────

const DESIGN_PUBLIC_SELECT = {
  id: true,
  slug: true,
  nameEn: true,
  nameHi: true,
  descriptionEn: true,
  descriptionHi: true,
  collection: true,
  style: true,
  basePricePaise: true,
  hiddenSteps: true,
  featured: true,
} as const;

export async function listDesigns(filter: { collection?: string | null } = {}) {
  const rows = await db.design.findMany({
    where: { active: true, ...(filter.collection ? { collection: filter.collection } : {}) },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { nameEn: "asc" }],
    select: DESIGN_PUBLIC_SELECT,
  });
  return rows.map((d) => ({ ...d, style: readStyle(d.style) }));
}

export async function getDesign(idOrSlug: string) {
  const d = await db.design.findFirst({ where: { active: true, OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, select: DESIGN_PUBLIC_SELECT });
  if (!d) throw notFound("design");
  return { ...d, style: readStyle(d.style) };
}

export async function listDesignOptions() {
  const rows = await db.designOption.findMany({
    where: { active: true },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { nameEn: "asc" }],
    select: { id: true, kind: true, slug: true, nameEn: true, nameHi: true, descriptionEn: true, descriptionHi: true, priceDeltaPaise: true },
  });
  return { finishes: rows.filter((r) => r.kind === "FINISH"), coverages: rows.filter((r) => r.kind === "COVERAGE") };
}

/** Studio steps the owner has switched off for every design. */
export async function getStudioHiddenSteps() {
  return readHiddenSteps(await getSetting("studio.hiddenSteps"));
}

// ───────────────────────────── Shared helpers ─────────────────────────────

const STATUS_FOR_SELECT = { id: true, reference: true, status: true, customerId: true, quotedPaise: true, customer: { select: { preferredLocale: true } } } as const;
type RequestRow = { id: string; reference: string; status: CustomizationStatus; customerId: string; quotedPaise: number | null; customer: { preferredLocale: string } };

/**
 * Apply one status change with compare-and-set: history, audit and the customer notification
 * commit together. Returns the notification event id for dispatch after commit.
 */
async function applyTransition(
  tx: Tx,
  actor: Actor,
  req: RequestRow,
  rule: CustomizationRule,
  opts: { reason?: string; data?: Prisma.CustomizationRequestUpdateManyMutationInput; customerVisible?: boolean; params?: Record<string, string> } = {},
) {
  const updated = await tx.customizationRequest.updateMany({ where: { id: req.id, status: req.status }, data: { status: rule.to, ...opts.data } });
  if (updated.count !== 1) throw new AppError("CONFLICT", "errors.conflict.stale");
  await tx.customizationStatusHistory.create({
    data: { requestId: req.id, fromStatus: req.status, toStatus: rule.to, actorId: actor.userId, reason: opts.reason || null, customerVisible: opts.customerVisible ?? true },
  });
  await audit(tx, actor, { action: `customization.${rule.to.toLowerCase()}`, entityType: "CustomizationRequest", entityId: req.id, before: { status: req.status }, after: { status: rule.to, reason: opts.reason, ...opts.data } });
  if (!rule.notify) return null;
  const t = createT(isLocale(req.customer.preferredLocale) ? req.customer.preferredLocale : "en");
  const historyCount = await tx.customizationStatusHistory.count({ where: { requestId: req.id } });
  return enqueue(tx, {
    type: rule.notify,
    recipientId: req.customerId,
    dedupeKey: `custom:${req.id}:${rule.to}:${historyCount}`,
    params: { reference: req.reference, status: t(`studio.status.${rule.to}`), reason: opts.reason ?? "", ...opts.params },
    href: `/account/designs/${req.reference}`,
  });
}

// ───────────────────────────── Customer: submit ─────────────────────────────

/**
 * FR-CUSTOM-01…08: submit a design request. Idempotent on `idempotencyKey`. The configuration
 * snapshot is assembled from active catalogue rows so names and the estimate cannot be forged.
 */
export async function submitCustomization(actor: Actor | null, rawInput: unknown, idempotencyKey: string) {
  await assertSection("customization");
  requireUser(actor);
  if (!/^[\w-]{16,64}$/.test(idempotencyKey)) throw new AppError("VALIDATION", "errors.validation", { fields: { idempotencyKey: "validation.required" } });

  const existing = await db.customizationRequest.findUnique({ where: { idempotencyKey }, select: { reference: true, customerId: true } });
  if (existing) {
    if (existing.customerId !== actor.userId) throw new AppError("CONFLICT", "errors.conflict.idempotency");
    return { reference: existing.reference, duplicate: true };
  }

  await enforce(`customization:${actor.userId}`, 3600, 10);
  const input = parse(customizationRequestSchema, rawInput);

  const [device, design, globalHidden] = await Promise.all([
    db.deviceModel.findFirst({
      where: { id: input.deviceModelId, active: true, category: { slug: { in: [...CUSTOMIZABLE_CATEGORIES] }, active: true } },
      select: { id: true, name: true, frame: true, brand: { select: { name: true } }, category: { select: { slug: true } } },
    }),
    input.designId ? db.design.findFirst({ where: { id: input.designId, active: true } }) : Promise.resolve(null),
    getStudioHiddenSteps(),
  ]);
  // Hidden studio steps (Admin → Design catalogue): whatever the client sent for them is replaced by the defaults.
  const steps = visibleSteps(globalHidden, design?.hiddenSteps ?? []);
  const showFinish = steps.includes("finish");
  if (!steps.includes("colour")) {
    input.palette = undefined;
    input.text = null;
  }
  if (!steps.includes("artwork")) input.artwork = null;
  const firstOption = (kind: "FINISH" | "COVERAGE") => db.designOption.findFirst({ where: { kind, active: true }, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] });
  const [finish, coverage] = await Promise.all([
    showFinish ? db.designOption.findFirst({ where: { id: input.finishOptionId, kind: "FINISH", active: true } }) : firstOption("FINISH"),
    showFinish ? db.designOption.findFirst({ where: { id: input.coverageOptionId, kind: "COVERAGE", active: true } }) : firstOption("COVERAGE"),
  ]);
  const invalid = (field: string) => new AppError("VALIDATION", "errors.validation", { fields: { [field]: "studio.validation.unavailable" } });
  if (!device) throw invalid("deviceModelId");
  if (input.designId && !design) throw invalid("designId");
  if (!finish) throw invalid("finishOptionId");
  if (!coverage) throw invalid("coverageOptionId");

  let artworkId: string | null = null;
  if (input.artwork) {
    const media = await db.mediaAsset.findFirst({
      where: { id: input.artwork.mediaId, uploadedById: actor.userId, purpose: "CUSTOM_ARTWORK", customizationRequestId: null },
      select: { id: true },
    });
    if (!media) throw new AppError("VALIDATION", "errors.validation", { fields: { artwork: "studio.validation.artwork" } });
    artworkId = media.id;
  }

  const baseStyle = design ? readStyle(design.style) : readStyle({ pattern: "solid", palette: input.palette ?? ["#111827", "#6b7280"] });
  const style = { ...baseStyle, palette: input.palette ?? baseStyle.palette };
  const estimate = estimatePaise({ basePricePaise: design?.basePricePaise, finishDeltaPaise: finish.priceDeltaPaise, coverageDeltaPaise: coverage.priceDeltaPaise });
  const snap = (o: typeof finish) => ({ id: o.id, slug: o.slug, nameEn: o.nameEn, nameHi: o.nameHi, deltaPaise: o.priceDeltaPaise });
  const configuration: CustomizationConfig = {
    version: 1,
    device: { id: device.id, name: device.name, brand: device.brand.name, kind: device.category.slug as DeviceKind, frame: device.frame },
    design: design ? { id: design.id, slug: design.slug, nameEn: design.nameEn, nameHi: design.nameHi } : null,
    style,
    finish: snap(finish),
    coverage: snap(coverage),
    text: input.text ?? null,
    artwork: input.artwork ?? null,
    estimate,
  };

  try {
    const { reference, eventId } = await db.$transaction(async (tx) => {
      const reference = await nextReference(tx);
      const request = await tx.customizationRequest.create({
        data: {
          reference,
          idempotencyKey,
          customerId: actor.userId,
          deviceModelId: device.id,
          designId: design?.id ?? null,
          finishOptionId: finish.id,
          coverageOptionId: coverage.id,
          configuration: configuration as unknown as Prisma.InputJsonValue,
          customerNotes: input.notes || null,
          estimatePaise: estimate.totalPaise,
        },
      });
      if (artworkId) {
        const linked = await tx.mediaAsset.updateMany({ where: { id: artworkId, customizationRequestId: null }, data: { customizationRequestId: request.id, draftKey: null } });
        if (linked.count !== 1) throw new AppError("VALIDATION", "errors.validation", { fields: { artwork: "studio.validation.artwork" } });
      }
      await tx.customizationStatusHistory.create({ data: { requestId: request.id, toStatus: "SUBMITTED", actorId: actor.userId, customerVisible: true } });
      await audit(tx, actor, { action: "customization.submit", entityType: "CustomizationRequest", entityId: request.id, after: { reference, estimate: estimate.totalPaise } });
      const eventId = await enqueue(tx, {
        type: "custom.submitted",
        recipientId: actor.userId,
        dedupeKey: `custom:${request.id}:submitted`,
        params: { reference },
        href: `/account/designs/${reference}`,
      });
      return { reference, eventId };
    });
    dispatchAfterCommit([eventId]);
    return { reference, duplicate: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await db.customizationRequest.findUnique({ where: { idempotencyKey }, select: { reference: true, customerId: true } });
      if (winner && winner.customerId === actor.userId) return { reference: winner.reference, duplicate: true };
    }
    throw err;
  }
}

// ───────────────────────────── Customer: read & act ─────────────────────────────

export async function listMyCustomizations(actor: Actor | null) {
  requireUser(actor);
  return db.customizationRequest.findMany({
    where: { customerId: actor.userId },
    orderBy: { createdAt: "desc" },
    select: {
      reference: true,
      status: true,
      configuration: true,
      estimatePaise: true,
      quotedPaise: true,
      createdAt: true,
      updatedAt: true,
      deviceModel: { select: { name: true, brand: { select: { name: true } } } },
    },
  });
}

export async function getMyCustomization(actor: Actor | null, reference: string) {
  requireUser(actor);
  const req = await db.customizationRequest.findFirst({
    where: { reference, customerId: actor.userId },
    select: {
      id: true,
      reference: true,
      status: true,
      configuration: true,
      customerNotes: true,
      estimatePaise: true,
      quotedPaise: true,
      nextSteps: true,
      createdAt: true,
      updatedAt: true,
      deviceModel: { select: { name: true, brand: { select: { name: true } } } },
      artwork: { select: { id: true, width: true, height: true } },
      history: { where: { customerVisible: true }, orderBy: { createdAt: "asc" }, select: { id: true, fromStatus: true, toStatus: true, reason: true, createdAt: true } },
      notes: { where: { visibility: "CUSTOMER" }, orderBy: { createdAt: "asc" }, select: { id: true, body: true, authorId: true, createdAt: true } },
    },
  });
  if (!req) throw notFound("request");
  const { notes, id, ...rest } = req;
  return { ...rest, id, notes: notes.map(({ authorId, ...n }) => ({ ...n, fromCustomer: authorId === actor.userId })) };
}

async function loadOwn(tx: Tx, actor: Actor, reference: string) {
  const req = await tx.customizationRequest.findFirst({ where: { reference, customerId: actor.userId }, select: STATUS_FOR_SELECT });
  if (!req) throw notFound("request");
  return req;
}

/** Customer answers a NEEDS_INFO request; the reply is stored as a customer-visible note and review resumes. */
export async function replyToCustomizationInfo(actor: Actor | null, reference: string, rawInput: unknown) {
  requireUser(actor);
  const { message } = parse(customizationReplySchema, rawInput);
  await enforce(`customization-reply:${actor.userId}`, 3600, 30);
  await db.$transaction(async (tx) => {
    const req = await loadOwn(tx, actor, reference);
    const rule = findCustomizationRule(req.status, "UNDER_REVIEW", "customer", "reply");
    if (!rule) throw new AppError("INVALID_TRANSITION", "errors.transition.notAllowed");
    await tx.customizationNote.create({ data: { requestId: req.id, authorId: actor.userId, body: message, visibility: "CUSTOMER" } });
    await applyTransition(tx, actor, req, rule, { reason: message });
  });
  return { ok: true };
}

/** Accept or decline the shared price (only the customer can decide — never staff on their behalf). */
export async function decideCustomizationQuote(actor: Actor | null, reference: string, rawInput: unknown) {
  requireUser(actor);
  const { decision, reason } = parse(customizationDecisionSchema, rawInput);
  const to = decision === "ACCEPT" ? "ACCEPTED" : "DECLINED";
  const eventId = await db.$transaction(async (tx) => {
    const req = await loadOwn(tx, actor, reference);
    const rule = findCustomizationRule(req.status, to, "customer", "decision");
    if (!rule) throw new AppError("QUOTE_NOT_ACTIONABLE", "studio.errors.quoteNotActionable");
    return applyTransition(tx, actor, req, rule, { reason: reason || undefined, params: { total: req.quotedPaise != null ? formatPaise(req.quotedPaise) : "" } });
  });
  dispatchAfterCommit([eventId]);
  return { status: to };
}

export async function cancelMyCustomization(actor: Actor | null, reference: string, rawInput: unknown = {}) {
  requireUser(actor);
  const { reason } = parse(customizationCancelSchema, rawInput ?? {});
  const eventId = await db.$transaction(async (tx) => {
    const req = await loadOwn(tx, actor, reference);
    const rule = findCustomizationRule(req.status, "CANCELLED", "customer");
    if (!rule) throw new AppError("INVALID_TRANSITION", "errors.transition.notAllowed");
    return applyTransition(tx, actor, req, rule, { reason: reason || undefined });
  });
  dispatchAfterCommit([eventId]);
  return { status: "CANCELLED" as const };
}

// ───────────────────────────── Staff ─────────────────────────────

const STAFF_VIEW = ["customization.manage", "customization.technical_input"] as const;
const PAGE_SIZE = 20;

export async function listCustomizationsForStaff(actor: Actor | null, filter: { status?: CustomizationStatus | "OPEN"; q?: string; page?: number } = {}) {
  assertCan(actor, ...STAFF_VIEW);
  const page = Math.max(1, filter.page ?? 1);
  // Unknown values (e.g. from an API query string) fall back to the open queue instead of erroring.
  const status = filter.status && (filter.status === "OPEN" || Object.hasOwn(CUSTOMIZATION_TONE, filter.status)) ? filter.status : "OPEN";
  const where: Prisma.CustomizationRequestWhereInput = {
    ...(status === "OPEN" ? { status: { in: ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO", "FEASIBILITY_CONFIRMED", "QUOTE_SHARED", "ACCEPTED"] } } : { status }),
    ...(filter.q
      ? {
          OR: [
            { reference: { contains: filter.q, mode: "insensitive" } },
            { customer: { name: { contains: filter.q, mode: "insensitive" } } },
            { customer: { phoneNumber: { contains: filter.q } } },
            { deviceModel: { name: { contains: filter.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.customizationRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        status: true,
        configuration: true,
        estimatePaise: true,
        quotedPaise: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { name: true, phoneNumber: true } },
        deviceModel: { select: { name: true, brand: { select: { name: true } } } },
        _count: { select: { artwork: true } },
      },
    }),
    db.customizationRequest.count({ where }),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE };
}

export async function getCustomizationForStaff(actor: Actor | null, id: string) {
  assertCan(actor, ...STAFF_VIEW);
  const req = await db.customizationRequest.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phoneNumber: true } },
      deviceModel: { select: { name: true, brand: { select: { name: true } }, category: { select: { slug: true, nameEn: true } } } },
      artwork: { select: { id: true, width: true, height: true, sizeBytes: true, createdAt: true } },
      history: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!req) throw notFound("request");
  const actorIds = [...new Set([...req.history.map((h) => h.actorId), ...req.notes.map((n) => n.authorId)].filter((x): x is string => !!x))];
  const users = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  return { ...req, names: Object.fromEntries(users.map((u) => [u.id, u.name])) };
}

async function loadForStaff(tx: Tx, id: string) {
  const req = await tx.customizationRequest.findUnique({ where: { id }, select: STATUS_FOR_SELECT });
  if (!req) throw notFound("request");
  return req;
}

export async function transitionCustomization(actor: Actor | null, id: string, rawInput: unknown) {
  assertCan(actor, "customization.manage");
  const { to, reason } = parse(customizationTransitionSchema, rawInput);
  const eventId = await db.$transaction(async (tx) => {
    const req = await loadForStaff(tx, id);
    const rule = findCustomizationRule(req.status, to, "staff");
    if (!rule) throw new AppError("INVALID_TRANSITION", "errors.transition.notAllowed");
    if (rule.requiresReason && reason.length < 3) throw new AppError("VALIDATION", "errors.validation", { fields: { reason: "validation.reason" } });
    return applyTransition(tx, actor, req, rule, { reason: reason || undefined });
  });
  dispatchAfterCommit([eventId]);
  return { status: to };
}

/** Share (or revise) the price with the customer → QUOTE_SHARED. A revision needs a fresh decision. */
export async function shareCustomizationQuote(actor: Actor | null, id: string, rawInput: unknown) {
  assertCan(actor, "customization.manage");
  const { quotedPaise, message } = parse(customizationQuoteSchema, rawInput);
  const eventId = await db.$transaction(async (tx) => {
    const req = await loadForStaff(tx, id);
    const rule = findCustomizationRule(req.status, "QUOTE_SHARED", "staff", "quote");
    if (!rule) throw new AppError("INVALID_TRANSITION", "errors.transition.notAllowed");
    return applyTransition(tx, actor, req, rule, { reason: message || undefined, data: { quotedPaise }, params: { total: formatPaise(quotedPaise) } });
  });
  dispatchAfterCommit([eventId]);
  return { status: "QUOTE_SHARED" as const, quotedPaise };
}

export async function setCustomizationNextSteps(actor: Actor | null, id: string, rawInput: unknown) {
  assertCan(actor, "customization.manage");
  const { nextSteps } = parse(customizationNextStepsSchema, rawInput);
  await db.$transaction(async (tx) => {
    const req = await loadForStaff(tx, id);
    await tx.customizationRequest.update({ where: { id: req.id }, data: { nextSteps: nextSteps || null } });
    await audit(tx, actor, { action: "customization.next_steps", entityType: "CustomizationRequest", entityId: req.id, after: { nextSteps } });
  });
  return { ok: true };
}

/** Notes: managers may write customer-visible notes (customer is notified); technical input is internal only. */
export async function addCustomizationNote(actor: Actor | null, id: string, rawInput: unknown) {
  assertCan(actor, ...STAFF_VIEW);
  const input = parse(customizationNoteSchema, rawInput);
  if (input.visibility === "CUSTOMER" && !can(actor, "customization.manage")) throw new AppError("FORBIDDEN", "errors.forbidden");
  const eventId = await db.$transaction(async (tx) => {
    const req = await loadForStaff(tx, id);
    const note = await tx.customizationNote.create({ data: { requestId: req.id, authorId: actor.userId, body: input.body, visibility: input.visibility } });
    await audit(tx, actor, { action: "customization.note", entityType: "CustomizationRequest", entityId: req.id, after: { noteId: note.id, visibility: input.visibility } });
    if (input.visibility !== "CUSTOMER") return null;
    const t = createT(isLocale(req.customer.preferredLocale) ? req.customer.preferredLocale : "en");
    return enqueue(tx, {
      type: "custom.updated",
      recipientId: req.customerId,
      dedupeKey: `custom:${req.id}:note:${note.id}`,
      params: { reference: req.reference, status: t(`studio.status.${req.status}`), reason: input.body.slice(0, 300) },
      href: `/account/designs/${req.reference}`,
    });
  });
  dispatchAfterCommit([eventId]);
  return { ok: true };
}
