import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { assertCan, can, type Actor } from "@/server/rbac/actor";

/**
 * Operational dashboard (PRD §7.1). Every widget is a count with a link to the filtered list.
 * Technicians see only their assigned work. Revenue is intentionally absent: no payment data exists yet.
 */
export async function getDashboard(actor: Actor | null) {
  assertCan(actor, "dashboard.view");

  const jobScope: Prisma.RepairJobWhereInput = can(actor, "job.view_all")
    ? {}
    : can(actor, "job.view_assigned")
      ? { assignments: { some: { technicianId: actor.userId, active: true } } }
      : { id: "__none__" };

  const todayIst = new Date(new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10));

  const [awaitingConfirmation, needsInfo, jobsByStatus, quotesAwaiting, awaitingReturn, todaysAppointments, failedNotifications] = await Promise.all([
    can(actor, "booking.view_all") ? db.repairBooking.count({ where: { status: "SUBMITTED" } }) : Promise.resolve(null),
    can(actor, "booking.view_all") ? db.repairBooking.count({ where: { status: "NEEDS_INFO" } }) : Promise.resolve(null),
    db.repairJob.groupBy({ by: ["status"], where: { ...jobScope, status: { notIn: ["COMPLETED", "CANCELLED"] } }, _count: { _all: true } }),
    db.repairJob.count({ where: { ...jobScope, status: { in: ["AWAITING_DECISION", "AWAITING_CUSTOMER_RESPONSE"] } } }),
    db.repairJob.count({ where: { ...jobScope, status: { in: ["READY_FOR_RETURN", "RETURN_COORDINATION"] } } }),
    can(actor, "booking.view_all")
      ? db.repairBooking.findMany({
          where: { status: { in: ["CONFIRMED", "SUBMITTED"] }, slot: { date: todayIst }, OR: [{ job: null }, { job: { status: "AWAITING_HANDOVER" } }] },
          orderBy: { slot: { startTime: "asc" } },
          select: { id: true, reference: true, contactName: true, handoverMethod: true, status: true, slot: { select: { startTime: true, endTime: true } }, job: { select: { id: true } } },
        })
      : Promise.resolve(null),
    can(actor, "notification.view_log") ? db.notificationDelivery.count({ where: { status: "FAILED" } }) : Promise.resolve(null),
  ]);

  const [ordersToReview, ordersInFulfilment, lowStock, designsToReview, designsQuoted, contentDrafts, contentScheduled] = await Promise.all([
    can(actor, "product_request.manage") ? db.productRequest.count({ where: { status: "SUBMITTED" } }) : Promise.resolve(null),
    can(actor, "product_request.manage") ? db.productRequest.count({ where: { status: { in: ["CONFIRMED", "FULFILLING"] } } }) : Promise.resolve(null),
    can(actor, "product.manage") || can(actor, "inventory.manage")
      ? db.$queryRaw<{ n: bigint }[]>`
          SELECT count(*)::bigint AS n FROM products p
          LEFT JOIN inventory_balances b ON b."productId" = p.id
          WHERE p.status = 'ACTIVE' AND COALESCE(b."onHand", 0) <= p."lowStockThreshold"`.then((r) => Number(r[0]?.n ?? 0))
      : Promise.resolve(null),
    can(actor, "customization.manage") ? db.customizationRequest.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }) : Promise.resolve(null),
    can(actor, "customization.manage") ? db.customizationRequest.count({ where: { status: "QUOTE_SHARED" } }) : Promise.resolve(null),
    can(actor, "content.edit") ? db.contentTranslation.count({ where: { status: "DRAFT" } }) : Promise.resolve(null),
    can(actor, "content.edit") ? db.contentTranslation.count({ where: { status: "SCHEDULED", scheduledAt: { gt: new Date() } } }) : Promise.resolve(null),
  ]);

  return {
    ordersToReview,
    ordersInFulfilment,
    lowStock,
    designsToReview,
    designsQuoted,
    contentDrafts,
    contentScheduled,
    awaitingConfirmation,
    needsInfo,
    jobsByStatus: Object.fromEntries(jobsByStatus.map((g) => [g.status, g._count._all])) as Record<string, number>,
    quotesAwaiting,
    awaitingReturn,
    todaysAppointments,
    failedNotifications,
  };
}
