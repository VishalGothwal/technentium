import "server-only";
import type { JobStatus } from "@/generated/prisma/enums";
import { audit } from "@/server/audit";
import type { Tx } from "@/server/db";
import { AppError } from "@/server/errors";
import { enqueue } from "@/server/notifications/outbox";
import type { Actor } from "@/server/rbac/actor";
import { can } from "@/server/rbac/actor";
import { actorMayApply, findJobRule, resumeTarget, type Guard, type JobRule } from "./state-machine";

type JobRow = {
  id: string;
  reference: string;
  status: JobStatus;
  previousStatus: JobStatus | null;
  bookingId: string;
  booking: { customerId: string };
};

export type TransitionOptions = {
  reason?: string | null;
  /** true when invoked by a domain service (quote send/decision, cancellation, expiry) */
  system?: boolean;
  notifyParams?: Record<string, string>;
};

async function isAssigned(tx: Tx, jobId: string, userId: string) {
  return !!(await tx.repairAssignment.findFirst({ where: { jobId, technicianId: userId, active: true }, select: { id: true } }));
}

export async function assertJobAccess(tx: Tx, actor: Actor, jobId: string) {
  if (can(actor, "job.view_all")) return;
  if (can(actor, "job.view_assigned") && (await isAssigned(tx, jobId, actor.userId))) return;
  throw new AppError("NOT_FOUND", "errors.notFound.job");
}

async function checkGuard(tx: Tx, guard: Guard, jobId: string) {
  switch (guard) {
    case "approvedQuote": {
      const quote = await tx.quote.findUnique({ where: { jobId }, select: { activeVersion: { select: { status: true } } } });
      if (quote?.activeVersion?.status !== "APPROVED") throw new AppError("INVALID_TRANSITION", "errors.transition.needsApproval");
      return;
    }
    case "passedQualityCheck": {
      const qc = await tx.qualityCheck.findFirst({ where: { jobId }, orderBy: { createdAt: "desc" }, select: { passed: true } });
      if (!qc?.passed) throw new AppError("INVALID_TRANSITION", "errors.transition.needsQualityCheck");
      return;
    }
    case "returnHandedOver": {
      const ret = await tx.repairReturn.findFirst({ where: { jobId, status: "HANDED_OVER" }, select: { id: true } });
      if (!ret) throw new AppError("INVALID_TRANSITION", "errors.transition.needsHandover");
      return;
    }
    case "inspectionRecorded": {
      const insp = await tx.repairInspection.findUnique({ where: { jobId }, select: { id: true } });
      if (!insp) throw new AppError("INVALID_TRANSITION", "errors.transition.needsInspection");
      return;
    }
  }
}

/**
 * The single place a job's status changes. Validates rule, actor, reason and guard; updates the
 * row with a compare-and-set on the current status (so two concurrent moves cannot both win);
 * writes status history, audit and the notification outbox — all in the caller's transaction.
 * Returns the outbox event id (if any) for post-commit dispatch.
 */
export async function applyJobTransition(
  tx: Tx,
  actor: Actor | null,
  job: JobRow,
  to: JobStatus,
  opts: TransitionOptions = {},
): Promise<string | null> {
  const resume = resumeTarget(job.status, job.previousStatus);
  let rule: JobRule | undefined;

  if (resume && to === resume) {
    if (!opts.system && !can(actor, "job.transition")) throw new AppError("FORBIDDEN", "errors.forbidden");
    rule = { from: ["ON_HOLD"], to, by: ["staff"], customerVisible: true };
  } else {
    rule = findJobRule(job.status, to);
    if (!rule) throw new AppError("INVALID_TRANSITION", "errors.transition.notAllowed", { from: job.status, to });
    const ctx = {
      system: !!opts.system,
      hasStaffTransition: can(actor, "job.transition"),
      hasAssignedTransition: can(actor, "job.transition_assigned"),
      isAssigned: actor ? await isAssigned(tx, job.id, actor.userId) : false,
    };
    if (!actorMayApply(rule, ctx)) throw new AppError("FORBIDDEN", "errors.transition.forbidden");
  }

  const reason = opts.reason?.trim() || null;
  if (rule.requiresReason && !reason) throw new AppError("VALIDATION", "errors.validation", { fields: { reason: "validation.reason" } });
  if (rule.guard) await checkGuard(tx, rule.guard, job.id);

  const now = new Date();
  const updated = await tx.repairJob.updateMany({
    where: { id: job.id, status: job.status },
    data: {
      status: to,
      previousStatus: to === "ON_HOLD" ? job.status : null,
      ...(to === "DEVICE_RECEIVED" ? { receivedAt: now } : {}),
      ...(to === "COMPLETED" ? { completedAt: now } : {}),
    },
  });
  if (updated.count !== 1) throw new AppError("CONFLICT", "errors.conflict.stale");

  await tx.repairStatusHistory.create({
    data: {
      entityType: "JOB",
      entityId: job.id,
      bookingId: job.bookingId,
      fromStatus: job.status,
      toStatus: to,
      actorId: actor?.userId ?? null,
      reason,
      customerVisible: rule.customerVisible,
    },
  });
  await audit(tx, actor, { action: `job.transition`, entityType: "RepairJob", entityId: job.id, before: { status: job.status }, after: { status: to, reason } });

  if (!rule.notify) return null;
  return enqueue(tx, {
    type: rule.notify,
    recipientId: job.booking.customerId,
    dedupeKey: `job:${job.id}:${job.status}->${to}:${now.getTime()}`,
    params: { reference: job.reference, reason: reason ?? "", ...opts.notifyParams },
    href: `/account/bookings/${job.reference}`,
  });
}

export const JOB_TRANSITION_SELECT = {
  id: true,
  reference: true,
  status: true,
  previousStatus: true,
  bookingId: true,
  booking: { select: { customerId: true } },
} as const;
