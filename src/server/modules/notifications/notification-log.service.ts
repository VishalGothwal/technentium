import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { DeliveryStatus } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { CHANNELS } from "@/server/notifications/matrix";

const STATUSES: readonly DeliveryStatus[] = ["PENDING", "SENT", "FAILED", "SKIPPED"];

/** Notification delivery log for staff (PRD §6.10 / FR-NOTIF-03). */
export async function listDeliveries(actor: Actor | null, filter: { status?: string; channel?: string; page?: number } = {}) {
  assertCan(actor, "notification.view_log");
  const pageSize = 50;
  const page = Math.max(1, filter.page ?? 1);
  const where: Prisma.NotificationDeliveryWhereInput = {
    ...(filter.status && (STATUSES as readonly string[]).includes(filter.status) ? { status: filter.status as DeliveryStatus } : {}),
    ...(filter.channel && (CHANNELS as readonly string[]).includes(filter.channel) ? { channel: filter.channel } : {}),
  };
  const [items, total] = await Promise.all([
    db.notificationDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { event: { select: { type: true, recipientId: true, createdAt: true, payload: true } } },
    }),
    db.notificationDelivery.count({ where }),
  ]);
  const recipientIds = [...new Set(items.map((i) => i.event.recipientId))];
  const people = await db.user.findMany({ where: { id: { in: recipientIds } }, select: { id: true, name: true } });
  return { items, total, page, pageSize, names: Object.fromEntries(people.map((p) => [p.id, p.name])) as Record<string, string> };
}

export const DELIVERY_STATUSES = STATUSES;
