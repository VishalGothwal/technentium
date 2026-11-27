import "server-only";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { isDeliverableEmail } from "@/server/providers/email";

/** Admin customer views. Full contact details need `customer.view` (staff/owner). */
/** Admin sections with their own customer list: people with at least one booking / order / design request there. */
export type CustomerSection = "repairs" | "protection" | "customization";
const SECTION_WHERE = {
  repairs: { bookings: { some: {} } },
  protection: { productRequests: { some: {} } },
  customization: { customizationRequests: { some: {} } },
} as const;

export async function listCustomers(actor: Actor | null, filter: { q?: string; page?: number; section?: CustomerSection } = {}) {
  assertCan(actor, "customer.view");
  const pageSize = 25;
  const page = Math.max(1, filter.page ?? 1);
  const where = {
    customerProfile: { isNot: null },
    staffProfile: null,
    ...(filter.section ? SECTION_WHERE[filter.section] : {}),
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
      select: { id: true, name: true, email: true, phoneNumber: true, createdAt: true, _count: { select: { bookings: true, productRequests: true, customizationRequests: true } } },
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
