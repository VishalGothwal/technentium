import "server-only";
import type { BookingStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db, type Tx } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { dispatchAfterCommit, enqueue } from "@/server/notifications/outbox";
import { enforce } from "@/server/rate-limit";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { getSetting } from "@/server/settings";
import { parse } from "@/server/validation";
import { bookingSchema, METHODS_NEEDING_ADDRESS, reasonSchema } from "@/lib/schemas/repair";
import { formatDate } from "@/lib/format";
import { resolveDiagnosisFee } from "@/server/modules/pricing/diagnosis-fee";
import { findBookingRule } from "./state-machine";
import { applyJobTransition, JOB_TRANSITION_SELECT } from "./transition";

function requireUser(actor: Actor | null): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
}

async function nextReference(tx: Tx): Promise<string> {
  const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('repair_booking_ref_seq')`;
  const yymm = new Date().toISOString().slice(2, 7).replace("-", "");
  return `TN-${yymm}-${String(nextval).padStart(5, "0")}`;
}

const slotLabel = (slot: { date: Date; startTime: string; endTime: string } | null, locale = "en") =>
  slot ? `${formatDate(slot.date, locale)}, ${slot.startTime}–${slot.endTime}` : "";

// ───────────────────────────── Customer: submit ─────────────────────────────

/**
 * Submit a repair booking (FR-BOOK-01…12). Idempotent on `idempotencyKey`: a retried submission
 * returns the original booking instead of creating a duplicate (FR-BOOK acceptance criteria).
 */
export async function submitBooking(actor: Actor | null, rawInput: unknown, idempotencyKey: string) {
  requireUser(actor);
  if (!/^[\w-]{16,64}$/.test(idempotencyKey)) throw new AppError("VALIDATION", "errors.validation", { fields: { idempotencyKey: "validation.required" } });

  const existing = await db.repairBooking.findUnique({ where: { idempotencyKey }, select: { reference: true, customerId: true } });
  if (existing) {
    if (existing.customerId !== actor.userId) throw new AppError("CONFLICT", "errors.conflict.idempotency");
    return { reference: existing.reference, duplicate: true };
  }

  await enforce(`booking:${actor.userId}`, 3600, 10);
  const input = parse(bookingSchema, rawInput);

  const model = await db.deviceModel.findFirst({ where: { id: input.modelId, active: true }, select: { id: true, categoryId: true, name: true } });
  if (!model) throw new AppError("VALIDATION", "errors.validation", { fields: { modelId: "validation.required" } });

  const issues = await db.repairIssueType.findMany({ where: { id: { in: input.issueTypeIds }, categoryId: model.categoryId, active: true }, select: { id: true } });
  if (issues.length !== new Set(input.issueTypeIds).size) throw new AppError("VALIDATION", "errors.validation", { fields: { issueTypeIds: "validation.issues" } });

  if (METHODS_NEEDING_ADDRESS.includes(input.handoverMethod)) {
    const area = await db.serviceableArea.findUnique({ where: { pincode: input.address!.pincode } });
    if (!area?.active) throw new AppError("UNSERVICEABLE", "errors.unserviceable");
  }

  const slot = await db.appointmentSlot.findFirst({ where: { id: input.slotId, active: true, date: { gte: new Date(new Date().toISOString().slice(0, 10)) } } });
  if (!slot) throw new AppError("VALIDATION", "errors.validation", { fields: { slotId: "validation.slot" } });

  const attachments = input.attachmentIds.length
    ? await db.repairAttachment.findMany({ where: { id: { in: input.attachmentIds }, uploadedById: actor.userId, bookingId: null, jobId: null, purpose: "BOOKING_PHOTO" }, select: { id: true } })
    : [];
  if (attachments.length !== input.attachmentIds.length) throw new AppError("VALIDATION", "errors.validation", { fields: { attachmentIds: "validation.photos" } });

  const [rules, defaultFee, policyVersion] = await Promise.all([
    db.diagnosisFeeRule.findMany({ where: { active: true } }),
    getSetting("booking.defaultDiagnosisFeePaise"),
    getSetting("policy.version"),
  ]);
  const fee = resolveDiagnosisFee(rules, { categoryId: model.categoryId, modelId: model.id, issueTypeIds: input.issueTypeIds }, defaultFee);

  try {
    const { reference, eventId } = await db.$transaction(async (tx) => {
      const reference = await nextReference(tx);
      const booking = await tx.repairBooking.create({
        data: {
          reference,
          idempotencyKey,
          customerId: actor.userId,
          modelId: model.id,
          description: input.description || null,
          handoverMethod: input.handoverMethod,
          slotId: slot.id,
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          diagnosisFeePaise: fee.feePaise,
          feeWaivedIfApproved: fee.waivedIfApproved,
          policyVersion,
          issues: { create: input.issueTypeIds.map((issueTypeId) => ({ issueTypeId })) },
          handover: {
            create: {
              addressLine1: input.address?.addressLine1 ?? null,
              addressLine2: input.address?.addressLine2 || null,
              landmark: input.address?.landmark || null,
              pincode: input.address?.pincode ?? null,
              city: input.address ? "Jaipur" : null,
              notes: input.handoverNotes || null,
            },
          },
        },
      });
      if (attachments.length) {
        await tx.repairAttachment.updateMany({ where: { id: { in: attachments.map((a) => a.id) } }, data: { bookingId: booking.id, draftKey: null } });
      }
      await tx.repairStatusHistory.create({
        data: { entityType: "BOOKING", entityId: booking.id, bookingId: booking.id, toStatus: "SUBMITTED", actorId: actor.userId, customerVisible: true },
      });
      await tx.consentRecord.create({ data: { userId: actor.userId, type: "repair_policy", policyVersion } });
      await audit(tx, actor, { action: "booking.submit", entityType: "RepairBooking", entityId: booking.id, after: { reference, fee } });
      const eventId = await enqueue(tx, {
        type: "booking.submitted",
        recipientId: actor.userId,
        dedupeKey: `booking:${booking.id}:submitted`,
        params: { reference },
        href: `/account/bookings/${reference}`,
      });
      return { reference, eventId };
    });
    dispatchAfterCommit([eventId]);
    return { reference, duplicate: false };
  } catch (err) {
    // Concurrent retry with the same key: the other request won the unique constraint.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await db.repairBooking.findUnique({ where: { idempotencyKey }, select: { reference: true, customerId: true } });
      if (winner && winner.customerId === actor.userId) return { reference: winner.reference, duplicate: true };
    }
    throw err;
  }
}

// ───────────────────────────── Customer: read & act ─────────────────────────────

export async function listMyBookings(actor: Actor | null) {
  requireUser(actor);
  return db.repairBooking.findMany({
    where: { customerId: actor.userId },
    orderBy: { createdAt: "desc" },
    select: {
      reference: true,
      status: true,
      createdAt: true,
      handoverMethod: true,
      model: { select: { name: true, brand: { select: { name: true } } } },
      job: { select: { status: true, previousStatus: true } },
    },
  });
}

/** Customer's view of one booking. Records of other customers resolve to NOT_FOUND (FR-AUTH-07, IDOR). */
export async function getMyBooking(actor: Actor | null, reference: string) {
  requireUser(actor);
  const booking = await db.repairBooking.findFirst({
    where: { reference, customerId: actor.userId },
    include: {
      model: { select: { name: true, brand: { select: { name: true } }, category: { select: { nameEn: true, nameHi: true } } } },
      issues: { include: { issueType: { select: { nameEn: true, nameHi: true } } } },
      handover: true,
      slot: true,
      attachments: { select: { id: true }, orderBy: { createdAt: "asc" } },
      job: {
        select: {
          id: true,
          status: true,
          previousStatus: true,
          notes: { where: { visibility: "CUSTOMER" }, orderBy: { createdAt: "asc" }, select: { id: true, body: true, createdAt: true } },
          returns: { orderBy: { createdAt: "desc" } },
          warranty: { include: { policy: true } },
          quote: {
            select: {
              activeVersion: { include: { lineItems: { orderBy: { sortOrder: "asc" } }, decision: true } },
              versions: {
                where: { status: { not: "DRAFT" } },
                orderBy: { number: "desc" },
                select: { id: true, number: true, status: true, totalPaise: true, sentAt: true, decision: { select: { decision: true, createdAt: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!booking) throw notFound("booking");

  const history = await db.repairStatusHistory.findMany({
    where: { bookingId: booking.id, customerVisible: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, entityType: true, toStatus: true, reason: true, createdAt: true },
  });

  // Never expose a draft quote to the customer.
  const active = booking.job?.quote?.activeVersion;
  const visibleQuote = active && active.status !== "DRAFT" ? active : null;

  return { ...booking, history, visibleQuote };
}

export async function cancelMyBooking(actor: Actor | null, reference: string) {
  requireUser(actor);
  const booking = await db.repairBooking.findFirst({ where: { reference, customerId: actor.userId } });
  if (!booking) throw notFound("booking");
  if (!findBookingRule(booking.status, "CANCELLED")?.by.includes("customer")) throw new AppError("INVALID_TRANSITION", "errors.booking.cannotCancel");

  const eventId = await db.$transaction((tx) => setBookingStatus(tx, actor, booking, "CANCELLED", "Cancelled by customer"));
  dispatchAfterCommit([eventId]);
}

export async function respondToInfoRequest(actor: Actor | null, reference: string, message: string) {
  requireUser(actor);
  const text = parse(reasonSchema, message);
  const booking = await db.repairBooking.findFirst({ where: { reference, customerId: actor.userId } });
  if (!booking) throw notFound("booking");
  if (booking.status !== "NEEDS_INFO") throw new AppError("INVALID_TRANSITION", "errors.booking.notAwaitingInfo");

  await db.$transaction(async (tx) => {
    await setBookingStatus(tx, actor, booking, "SUBMITTED", text);
    await tx.repairBooking.update({
      where: { id: booking.id },
      data: { description: [booking.description, `Customer reply: ${text}`].filter(Boolean).join("\n\n") },
    });
  });
}

// ───────────────────────────── Staff ─────────────────────────────

async function setBookingStatus(
  tx: Tx,
  actor: Actor,
  booking: { id: string; reference: string; status: BookingStatus; customerId: string },
  to: BookingStatus,
  reason: string | null,
  notifyParams: Record<string, string> = {},
) {
  const rule = findBookingRule(booking.status, to);
  if (!rule) throw new AppError("INVALID_TRANSITION", "errors.transition.notAllowed", { from: booking.status, to });
  if (rule.requiresReason && !reason) throw new AppError("VALIDATION", "errors.validation", { fields: { reason: "validation.reason" } });

  const updated = await tx.repairBooking.updateMany({
    where: { id: booking.id, status: booking.status },
    data: { status: to, statusReason: reason },
  });
  if (updated.count !== 1) throw new AppError("CONFLICT", "errors.conflict.stale");

  await tx.repairStatusHistory.create({
    data: { entityType: "BOOKING", entityId: booking.id, bookingId: booking.id, fromStatus: booking.status, toStatus: to, actorId: actor.userId, reason, customerVisible: true },
  });
  await audit(tx, actor, { action: `booking.${to.toLowerCase()}`, entityType: "RepairBooking", entityId: booking.id, before: { status: booking.status }, after: { status: to, reason } });

  if (!rule.notify) return null;
  return enqueue(tx, {
    type: rule.notify,
    recipientId: booking.customerId,
    dedupeKey: `booking:${booking.id}:${booking.status}->${to}:${Date.now()}`,
    params: { reference: booking.reference, reason: reason ?? "", ...notifyParams },
    href: `/account/bookings/${booking.reference}`,
  });
}

/** Lock the slot row and verify confirmed bookings stay within capacity (FR-BOOK-07). */
async function assertSlotCapacity(tx: Tx, slotId: string, excludeBookingId: string) {
  const [slot] = await tx.$queryRaw<{ capacity: number; active: boolean }[]>`
    SELECT capacity, active FROM appointment_slots WHERE id = ${slotId} FOR UPDATE`;
  if (!slot || !slot.active) throw new AppError("SLOT_FULL", "errors.slot.unavailable");
  const confirmed = await tx.repairBooking.count({ where: { slotId, status: "CONFIRMED", id: { not: excludeBookingId } } });
  if (confirmed >= slot.capacity) throw new AppError("SLOT_FULL", "errors.slot.full");
}

export async function confirmBooking(actor: Actor | null, bookingId: string, opts: { technicianId?: string | null } = {}) {
  assertCan(actor, "booking.confirm");
  const booking = await db.repairBooking.findUnique({ where: { id: bookingId }, include: { slot: true } });
  if (!booking) throw notFound("booking");

  const eventId = await db.$transaction(async (tx) => {
    if (booking.slotId) await assertSlotCapacity(tx, booking.slotId, booking.id);
    const eventId = await setBookingStatus(tx, actor, booking, "CONFIRMED", null, { slot: slotLabel(booking.slot) });
    const job = await tx.repairJob.create({ data: { reference: booking.reference, bookingId: booking.id } });
    await tx.repairStatusHistory.create({
      data: { entityType: "JOB", entityId: job.id, bookingId: booking.id, toStatus: "AWAITING_HANDOVER", actorId: actor.userId, customerVisible: false },
    });
    if (opts.technicianId) await assignTechnicianTx(tx, actor, job.id, opts.technicianId);
    return eventId;
  });
  dispatchAfterCommit([eventId]);
}

export async function declineBooking(actor: Actor | null, bookingId: string, reason: string) {
  assertCan(actor, "booking.decline");
  const text = parse(reasonSchema, reason);
  const booking = await db.repairBooking.findUnique({ where: { id: bookingId } });
  if (!booking) throw notFound("booking");
  const eventId = await db.$transaction((tx) => setBookingStatus(tx, actor, booking, "DECLINED", text));
  dispatchAfterCommit([eventId]);
}

export async function requestBookingInfo(actor: Actor | null, bookingId: string, reason: string) {
  assertCan(actor, "booking.request_info");
  const text = parse(reasonSchema, reason);
  const booking = await db.repairBooking.findUnique({ where: { id: bookingId } });
  if (!booking) throw notFound("booking");
  const eventId = await db.$transaction((tx) => setBookingStatus(tx, actor, booking, "NEEDS_INFO", text));
  dispatchAfterCommit([eventId]);
}

export async function rescheduleBooking(actor: Actor | null, bookingId: string, slotId: string, reason: string) {
  assertCan(actor, "booking.reschedule");
  const text = parse(reasonSchema, reason);
  const booking = await db.repairBooking.findUnique({ where: { id: bookingId }, include: { job: { select: { status: true } } } });
  if (!booking) throw notFound("booking");
  const reschedulable = booking.status === "SUBMITTED" || (booking.status === "CONFIRMED" && booking.job?.status === "AWAITING_HANDOVER");
  if (!reschedulable) throw new AppError("INVALID_TRANSITION", "errors.booking.cannotReschedule");
  if (booking.slotId === slotId) throw new AppError("VALIDATION", "errors.validation", { fields: { slotId: "validation.slotSame" } });

  const eventId = await db.$transaction(async (tx) => {
    if (booking.status === "CONFIRMED") await assertSlotCapacity(tx, slotId, booking.id);
    const slot = await tx.appointmentSlot.findUnique({ where: { id: slotId } });
    if (!slot?.active) throw new AppError("SLOT_FULL", "errors.slot.unavailable");
    await tx.repairBooking.update({ where: { id: booking.id }, data: { slotId } });
    await tx.repairStatusHistory.create({
      data: { entityType: "BOOKING", entityId: booking.id, bookingId: booking.id, fromStatus: booking.status, toStatus: "RESCHEDULED", actorId: actor.userId, reason: text, customerVisible: true },
    });
    await audit(tx, actor, { action: "booking.reschedule", entityType: "RepairBooking", entityId: booking.id, before: { slotId: booking.slotId }, after: { slotId, reason: text } });
    return enqueue(tx, {
      type: "booking.rescheduled",
      recipientId: booking.customerId,
      dedupeKey: `booking:${booking.id}:reschedule:${slotId}:${Date.now()}`,
      params: { reference: booking.reference, reason: text, slot: slotLabel(slot) },
      href: `/account/bookings/${booking.reference}`,
    });
  });
  dispatchAfterCommit([eventId]);
}

export async function staffCancelBooking(actor: Actor | null, bookingId: string, reason: string) {
  assertCan(actor, "booking.cancel");
  const text = parse(reasonSchema, reason);
  const booking = await db.repairBooking.findUnique({ where: { id: bookingId }, include: { job: { select: JOB_TRANSITION_SELECT } } });
  if (!booking) throw notFound("booking");

  const eventId = await db.$transaction(async (tx) => {
    if (booking.job) {
      if (booking.job.status !== "AWAITING_HANDOVER") throw new AppError("INVALID_TRANSITION", "errors.booking.cannotCancel");
      await applyJobTransition(tx, actor, booking.job, "CANCELLED", { system: true, reason: text });
    }
    return setBookingStatus(tx, actor, booking, "CANCELLED", text);
  });
  dispatchAfterCommit([eventId]);
}

export async function assignTechnicianTx(tx: Tx, actor: Actor, jobId: string, technicianId: string) {
  const tech = await tx.user.findFirst({
    where: { id: technicianId, staffProfile: { active: true }, roles: { some: { role: { permissions: { some: { permission: { key: "job.transition_assigned" } } } } } } },
    select: { id: true },
  });
  if (!tech) throw new AppError("VALIDATION", "errors.validation", { fields: { technicianId: "validation.technician" } });
  await tx.repairAssignment.updateMany({ where: { jobId, active: true }, data: { active: false, endedAt: new Date() } });
  await tx.repairAssignment.create({ data: { jobId, technicianId, assignedById: actor.userId } });
  await audit(tx, actor, { action: "job.assign", entityType: "RepairJob", entityId: jobId, after: { technicianId } });
}

export type BookingQueueFilter = { status?: BookingStatus | "OPEN"; q?: string; page?: number };

export async function listBookingsForStaff(actor: Actor | null, filter: BookingQueueFilter = {}) {
  assertCan(actor, "booking.view_all");
  const pageSize = 25;
  const page = Math.max(1, filter.page ?? 1);
  const where: Prisma.RepairBookingWhereInput = {
    ...(filter.status === "OPEN" || !filter.status ? { status: { in: ["SUBMITTED", "NEEDS_INFO"] } } : { status: filter.status }),
    ...(filter.q
      ? { OR: [{ reference: { contains: filter.q, mode: "insensitive" } }, { contactName: { contains: filter.q, mode: "insensitive" } }, { contactPhone: { contains: filter.q } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.repairBooking.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        model: { select: { name: true, brand: { select: { name: true } } } },
        issues: { include: { issueType: { select: { nameEn: true } } } },
        slot: true,
        handover: { select: { pincode: true } },
      },
    }),
    db.repairBooking.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getBookingForStaff(actor: Actor | null, bookingId: string) {
  assertCan(actor, "booking.view_all");
  const booking = await db.repairBooking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { select: { id: true, name: true, email: true, phoneNumber: true } },
      model: { select: { name: true, brand: { select: { name: true } }, category: { select: { nameEn: true } } } },
      issues: { include: { issueType: { select: { nameEn: true } } } },
      handover: true,
      slot: true,
      attachments: { select: { id: true } },
      job: { select: { id: true, status: true } },
    },
  });
  if (!booking) throw notFound("booking");
  const history = await db.repairStatusHistory.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } });
  return { ...booking, history };
}
