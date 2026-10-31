import "server-only";
import type { HandoverMethod, JobStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { dispatchAfterCommit } from "@/server/notifications/outbox";
import { assertCan, can, type Actor } from "@/server/rbac/actor";
import { parse } from "@/server/validation";
import { diagnosisSchema, inspectionSchema, noteSchema, qualityCheckSchema } from "@/lib/schemas/repair";
import { assignTechnicianTx } from "./booking.service";
import { manualTargets, TERMINAL_JOB_STATUSES } from "./state-machine";
import { applyJobTransition, assertJobAccess, JOB_TRANSITION_SELECT } from "./transition";
import { ensureCompletionReturn } from "./return.service";

export type JobFilter = {
  status?: JobStatus | "ACTIVE";
  technicianId?: string;
  handoverMethod?: HandoverMethod;
  from?: string; // yyyy-mm-dd
  to?: string;
  q?: string;
  page?: number;
};

function scopeWhere(actor: Actor): Prisma.RepairJobWhereInput {
  if (can(actor, "job.view_all")) return {};
  if (can(actor, "job.view_assigned")) return { assignments: { some: { technicianId: actor.userId, active: true } } };
  throw new AppError("FORBIDDEN", "errors.forbidden");
}

export async function listJobs(actor: Actor | null, filter: JobFilter = {}, opts: { pageSize?: number } = {}) {
  assertCan(actor, "job.view_all", "job.view_assigned");
  const pageSize = opts.pageSize ?? 25;
  const page = Math.max(1, filter.page ?? 1);
  const where: Prisma.RepairJobWhereInput = {
    AND: [
      scopeWhere(actor),
      filter.status === "ACTIVE" || !filter.status ? { status: { notIn: [...TERMINAL_JOB_STATUSES] } } : { status: filter.status },
      filter.technicianId ? { assignments: { some: { technicianId: filter.technicianId, active: true } } } : {},
      filter.handoverMethod ? { booking: { handoverMethod: filter.handoverMethod } } : {},
      filter.from ? { createdAt: { gte: new Date(`${filter.from}T00:00:00+05:30`) } } : {},
      filter.to ? { createdAt: { lte: new Date(`${filter.to}T23:59:59+05:30`) } } : {},
      filter.q
        ? { OR: [{ reference: { contains: filter.q, mode: "insensitive" } }, { booking: { contactName: { contains: filter.q, mode: "insensitive" } } }] }
        : {},
    ],
  };
  const [items, total] = await Promise.all([
    db.repairJob.findMany({
      where,
      orderBy: [{ priority: "desc" }, { updatedAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        booking: {
          select: {
            id: true,
            contactName: true,
            handoverMethod: true,
            customerId: true,
            model: { select: { name: true, brand: { select: { name: true } } } },
          },
        },
        assignments: { where: { active: true }, select: { technician: { select: { id: true, name: true } } } },
      },
    }),
    db.repairJob.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getJobDetail(actor: Actor | null, jobId: string) {
  assertCan(actor, "job.view_all", "job.view_assigned");
  await assertJobAccess(db, actor, jobId);

  const job = await db.repairJob.findUnique({
    where: { id: jobId },
    include: {
      booking: {
        include: {
          customer: { select: { id: true, name: true, email: true, phoneNumber: true } },
          model: { select: { name: true, brand: { select: { name: true } }, category: { select: { id: true, nameEn: true } } } },
          issues: { include: { issueType: { select: { id: true, nameEn: true } } } },
          handover: true,
          slot: true,
          attachments: { select: { id: true, createdAt: true } },
        },
      },
      assignments: { orderBy: { createdAt: "desc" }, include: { technician: { select: { id: true, name: true } } } },
      inspection: true,
      diagnosis: true,
      qualityChecks: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      attachments: { select: { id: true, purpose: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      returns: { orderBy: { createdAt: "desc" } },
      warranty: { include: { policy: true } },
      quote: {
        include: {
          activeVersion: { select: { id: true, status: true } },
          versions: { orderBy: { number: "desc" }, include: { lineItems: { orderBy: { sortOrder: "asc" } }, decision: true } },
        },
      },
    },
  });
  if (!job) throw notFound("job");

  const [history, auditTrail] = await Promise.all([
    db.repairStatusHistory.findMany({ where: { bookingId: job.bookingId }, orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({ where: { entityType: "RepairJob", entityId: job.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const actorIds = [
    ...new Set(
      [
        ...history.map((h) => h.actorId),
        ...job.notes.map((n) => n.authorId),
        ...auditTrail.map((a) => a.actorId),
        job.inspection?.recordedById,
        job.diagnosis?.recordedById,
        ...job.qualityChecks.map((q) => q.checkedById),
        ...(job.quote?.versions ?? []).flatMap((v) => [v.createdById, v.sentById]),
        ...job.returns.map((r) => r.handedOverById),
      ].filter((x): x is string => !!x),
    ),
  ];
  const people = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const names = Object.fromEntries(people.map((p) => [p.id, p.name]));

  // Technicians only see the customer data needed for their assigned work (PRD §8 "assigned-job data").
  const limitedCustomer = !can(actor, "customer.view");
  const isAssigned = job.assignments.some((a) => a.active && a.technician.id === actor.userId);
  const targets = manualTargets(job.status, job.previousStatus, {
    hasStaffTransition: can(actor, "job.transition"),
    hasAssignedTransition: can(actor, "job.transition_assigned"),
    isAssigned,
  });

  return {
    job: limitedCustomer ? { ...job, booking: { ...job.booking, customer: { ...job.booking.customer, email: null } } } : job,
    history,
    auditTrail,
    names,
    targets,
    isAssigned,
  };
}

export async function transitionJob(actor: Actor | null, jobId: string, to: JobStatus, reason?: string | null) {
  assertCan(actor, "job.transition", "job.transition_assigned");
  const job = await db.repairJob.findUnique({ where: { id: jobId }, select: { ...JOB_TRANSITION_SELECT, booking: { select: { customerId: true, handoverMethod: true } } } });
  if (!job) throw notFound("job");
  await assertJobAccess(db, actor, jobId);

  const eventId = await db.$transaction(async (tx) => {
    const id = await applyJobTransition(tx, actor, job, to, { reason });
    if (to === "READY_FOR_RETURN" && job.status === "QUALITY_CHECK") {
      await ensureCompletionReturn(tx, actor, job.id, job.booking.handoverMethod);
    }
    return id;
  });
  dispatchAfterCommit([eventId]);
}

export async function assignTechnician(actor: Actor | null, jobId: string, technicianId: string) {
  assertCan(actor, "job.assign");
  const job = await db.repairJob.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw notFound("job");
  if (TERMINAL_JOB_STATUSES.includes(job.status)) throw new AppError("INVALID_TRANSITION", "errors.job.closed");
  await db.$transaction((tx) => assignTechnicianTx(tx, actor, jobId, technicianId));
}

export async function setPriority(actor: Actor | null, jobId: string, priority: "LOW" | "NORMAL" | "HIGH" | "URGENT") {
  assertCan(actor, "job.transition");
  await db.$transaction(async (tx) => {
    const before = await tx.repairJob.findUnique({ where: { id: jobId }, select: { priority: true } });
    if (!before) throw notFound("job");
    await tx.repairJob.update({ where: { id: jobId }, data: { priority } });
    await audit(tx, actor, { action: "job.priority", entityType: "RepairJob", entityId: jobId, before, after: { priority } });
  });
}

/** Receipt condition (FR-REPAIR-03). Recording it on a just-received device moves it into inspection. */
export async function recordInspection(actor: Actor | null, jobId: string, raw: unknown) {
  assertCan(actor, "job.inspect");
  await assertJobAccess(db, actor, jobId);
  const input = parse(inspectionSchema, raw);
  const job = await db.repairJob.findUnique({ where: { id: jobId }, select: JOB_TRANSITION_SELECT });
  if (!job) throw notFound("job");
  if (!["DEVICE_RECEIVED", "INSPECTION"].includes(job.status)) throw new AppError("INVALID_TRANSITION", "errors.job.inspectionStage");

  const eventId = await db.$transaction(async (tx) => {
    await tx.repairInspection.upsert({
      where: { jobId },
      create: { jobId, ...input, recordedById: actor.userId },
      update: { ...input, recordedById: actor.userId },
    });
    await audit(tx, actor, { action: "job.inspection", entityType: "RepairJob", entityId: jobId, after: input });
    if (job.status === "DEVICE_RECEIVED") return applyJobTransition(tx, actor, job, "INSPECTION");
    return null;
  });
  dispatchAfterCommit([eventId]);
}

/** Diagnosis (FR-REPAIR-04). Staff-only `quote.manage` users may also edit it while preparing the quote. */
export async function recordDiagnosis(actor: Actor | null, jobId: string, raw: unknown) {
  assertCan(actor, "job.diagnose", "quote.diagnosis_input", "quote.manage");
  await assertJobAccess(db, actor, jobId);
  const input = parse(diagnosisSchema, raw);
  const job = await db.repairJob.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw notFound("job");
  if (!["INSPECTION", "QUOTE_PREPARED", "AWAITING_DECISION", "IN_PROGRESS"].includes(job.status)) throw new AppError("INVALID_TRANSITION", "errors.job.diagnosisStage");

  await db.$transaction(async (tx) => {
    await tx.repairDiagnosis.upsert({
      where: { jobId },
      create: { jobId, ...input, recordedById: actor.userId },
      update: { ...input, recordedById: actor.userId },
    });
    await audit(tx, actor, { action: "job.diagnosis", entityType: "RepairJob", entityId: jobId, after: input });
  });
}

export async function recordQualityCheck(actor: Actor | null, jobId: string, raw: unknown) {
  assertCan(actor, "job.quality_check", "job.transition");
  await assertJobAccess(db, actor, jobId);
  const input = parse(qualityCheckSchema, raw);
  const job = await db.repairJob.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw notFound("job");
  if (job.status !== "QUALITY_CHECK") throw new AppError("INVALID_TRANSITION", "errors.job.qcStage");
  await db.$transaction(async (tx) => {
    await tx.qualityCheck.create({ data: { jobId, ...input, checkedById: actor.userId } });
    await audit(tx, actor, { action: "job.quality_check", entityType: "RepairJob", entityId: jobId, after: input });
  });
}

export async function recordRepairWork(actor: Actor | null, jobId: string, data: { repairNotes?: string; partsUsed?: string }) {
  assertCan(actor, "job.transition", "job.transition_assigned");
  await assertJobAccess(db, actor, jobId);
  const repairNotes = data.repairNotes?.trim().slice(0, 4000) || null;
  const partsUsed = data.partsUsed?.trim().slice(0, 2000) || null;
  await db.$transaction(async (tx) => {
    await tx.repairJob.update({ where: { id: jobId }, data: { repairNotes, partsUsed } });
    await audit(tx, actor, { action: "job.repair_work", entityType: "RepairJob", entityId: jobId, after: { repairNotes, partsUsed } });
  });
}

/** Internal notes never reach the customer unless explicitly marked customer-visible (FR-REPAIR-10). */
export async function addJobNote(actor: Actor | null, jobId: string, raw: unknown) {
  assertCan(actor, "job.note");
  await assertJobAccess(db, actor, jobId);
  const input = parse(noteSchema, raw);
  await db.$transaction(async (tx) => {
    const note = await tx.jobNote.create({ data: { jobId, authorId: actor.userId, body: input.body, visibility: input.visibility } });
    await audit(tx, actor, { action: "job.note", entityType: "RepairJob", entityId: jobId, after: { noteId: note.id, visibility: input.visibility } });
  });
}

export async function listTechnicians() {
  return db.user.findMany({
    where: { staffProfile: { active: true }, roles: { some: { role: { permissions: { some: { permission: { key: "job.transition_assigned" } } } } } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
