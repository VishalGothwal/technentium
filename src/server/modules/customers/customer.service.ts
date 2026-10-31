import "server-only";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { isDeliverableEmail } from "@/server/providers/email";

/** Admin customer views. Full contact details need `customer.view` (staff/owner). */
export async function listCustomers(actor: Actor | null, filter: { q?: string; page?: number } = {}) {
  assertCan(actor, "customer.view");
  const pageSize = 25;
  const page = Math.max(1, filter.page ?? 1);
  const where = {
    customerProfile: { isNot: null },
    staffProfile: null,
    ...(filter.q
      ? { OR: [{ name: { contains: filter.q, mode: "insensitive" as const } }, { email: { contains: filter.q, mode: "insensitive" as const } }, { phoneNumber: { contains: filter.q } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, email: true, phoneNumber: true, createdAt: true, _count: { select: { bookings: true } } },
    }),
    db.user.count({ where }),
  ]);
  return { items: items.map((u) => ({ ...u, email: isDeliverableEmail(u.email) ? u.email : null })), total, page, pageSize };
}

export async function getCustomer(actor: Actor | null, userId: string) {
  assertCan(actor, "customer.view");
  const user = await db.user.findFirst({
    where: { id: userId, customerProfile: { isNot: null } },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      phoneNumber: true,
      phoneNumberVerified: true,
      preferredLocale: true,
      createdAt: true,
      bookings: {
        orderBy: { createdAt: "desc" },
        select: { id: true, reference: true, status: true, createdAt: true, model: { select: { name: true } }, job: { select: { id: true, status: true } } },
      },
    },
  });
  if (!user) throw notFound("customer");
  return { ...user, email: isDeliverableEmail(user.email) ? user.email : null };
}
