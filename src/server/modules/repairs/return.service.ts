import "server-only";
import type { HandoverMethod } from "@/generated/prisma/enums";
import { audit } from "@/server/audit";
import { db, type Tx } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { dispatchAfterCommit } from "@/server/notifications/outbox";
import { assertCan, can, type Actor } from "@/server/rbac/actor";
import { getSetting } from "@/server/settings";
import { applyJobTransition, JOB_TRANSITION_SELECT } from "./transition";

/** Return method implied by how the device came in (completed repairs). */
const METHOD_FOR_HANDOVER: Record<HandoverMethod, "COLLECTION" | "DELIVERY"> = {
  PICKUP_DROP: "DELIVERY",
  DROP_OFF_DELIVERY: "DELIVERY",
  WALK_IN: "COLLECTION",
  ONSITE: "COLLECTION", // handed back on site by the technician
};

/** Create the return task for a completed repair when it becomes ready (charge included in the repair). */
export async function ensureCompletionReturn(tx: Tx, actor: Actor | null, jobId: string, handoverMethod: HandoverMethod) {
  const open = await tx.repairReturn.findFirst({ where: { jobId, status: { in: ["PENDING", "SCHEDULED"] } } });
  if (open) return open;
  const handover = await tx.handoverDetail.findFirst({ where: { booking: { job: { id: jobId } } } });
  const ret = await tx.repairReturn.create({
    data: {
      jobId,
      reason: "COMPLETED",
      method: METHOD_FOR_HANDOVER[handoverMethod],
      chargePaise: 0,
      acceptedAt: new Date(),
      addressLine1: handover?.addressLine1 ?? null,
      addressLine2: handover?.addressLine2 ?? null,
      pincode: handover?.pincode ?? null,
    },
  });
  await audit(tx, actor, { action: "return.create", entityType: "RepairJob", entityId: jobId, after: { returnId: ret.id, method: ret.method } });
  return ret;
}

export async function returnChargeFor(method: "COLLECTION" | "DELIVERY") {
  return method === "DELIVERY" ? getSetting("return.deliveryChargePaise") : getSetting("return.collectionChargePaise");
}

export async function scheduleReturn(actor: Actor | null, returnId: string, input: { scheduledAt: string; notes?: string }) {
  assertCan(actor, "return.manage");
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new AppError("VALIDATION", "errors.validation", { fields: { scheduledAt: "validation.date" } });

  const ret = await db.repairReturn.findUnique({ where: { id: returnId }, include: { job: { select: JOB_TRANSITION_SELECT } } });
  if (!ret) throw notFound("return");
  if (!["PENDING", "SCHEDULED"].includes(ret.status)) throw new AppError("INVALID_TRANSITION", "errors.return.closed");

  const eventId = await db.$transaction(async (tx) => {
    await tx.repairReturn.update({ where: { id: returnId }, data: { status: "SCHEDULED", scheduledAt: when, notes: input.notes?.trim() || null } });
    await audit(tx, actor, { action: "return.schedule", entityType: "RepairJob", entityId: ret.jobId, after: { returnId, scheduledAt: when } });
    // Declined path: scheduling the return makes the (unrepaired) device ready to go back.
    if (ret.job.status === "RETURN_COORDINATION") return applyJobTransition(tx, actor, ret.job, "READY_FOR_RETURN");
    return null;
  });
  dispatchAfterCommit([eventId]);
}

/**
 * Record the physical handover and complete the job in one step. Technicians may do this for
 * jobs assigned to them (e.g. onsite repairs).
 */
export async function markHandedOver(actor: Actor | null, returnId: string, notes?: string) {
  assertCan(actor, "return.manage", "return.handover_assigned");
  const ret = await db.repairReturn.findUnique({ where: { id: returnId }, include: { job: { select: JOB_TRANSITION_SELECT } } });
  if (!ret) throw notFound("return");
  if (!can(actor, "return.manage")) {
    const assigned = await db.repairAssignment.findFirst({ where: { jobId: ret.jobId, technicianId: actor.userId, active: true } });
    if (!assigned) throw new AppError("NOT_FOUND", "errors.notFound.return");
  }
  if (!["PENDING", "SCHEDULED"].includes(ret.status)) throw new AppError("INVALID_TRANSITION", "errors.return.closed");
  if (ret.job.status !== "READY_FOR_RETURN") throw new AppError("INVALID_TRANSITION", "errors.return.notReady");

  const eventId = await db.$transaction(async (tx) => {
    await tx.repairReturn.update({
      where: { id: returnId },
      data: { status: "HANDED_OVER", handedOverAt: new Date(), handedOverById: actor.userId, notes: notes?.trim() || ret.notes },
    });
    await audit(tx, actor, { action: "return.handover", entityType: "RepairJob", entityId: ret.jobId, after: { returnId } });
    const id = await applyJobTransition(tx, actor, ret.job, "COMPLETED");
    if (ret.reason === "COMPLETED") await issueWarranty(tx, ret.jobId);
    return id;
  });
  dispatchAfterCommit([eventId]);
}

async function issueWarranty(tx: Tx, jobId: string) {
  const policyId = await getSetting("warranty.defaultPolicyId", tx);
  const policy = policyId
    ? await tx.warrantyPolicy.findFirst({ where: { id: policyId, active: true } })
    : await tx.warrantyPolicy.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  if (!policy) return;
  const startsAt = new Date();
  await tx.repairWarranty.upsert({
    where: { jobId },
    create: { jobId, policyId: policy.id, startsAt, endsAt: new Date(startsAt.getTime() + policy.days * 86_400_000) },
    update: {},
  });
}
