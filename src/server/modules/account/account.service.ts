import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { parse } from "@/server/validation";
import { OPTIONAL_CHANNELS, type Channel } from "@/server/notifications/matrix";
import { render } from "@/server/notifications/templates";
import { customerStep, CUSTOMER_STEPS, type NotificationType } from "@/server/modules/repairs/state-machine";
import type { Actor } from "@/server/rbac/actor";
import { createT } from "@/i18n/translate";
import { LOCALES, type Locale } from "@/i18n/config";
import { isDeliverableEmail } from "@/server/providers/email";

function requireUser(actor: Actor | null): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
}

// ───────────── Profile ─────────────

export async function getProfile(actor: Actor | null) {
  requireUser(actor);
  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.userId },
    select: { id: true, name: true, email: true, emailVerified: true, phoneNumber: true, phoneNumberVerified: true, preferredLocale: true, twoFactorEnabled: true, createdAt: true },
  });
  return {
    ...user,
    // Phone-only accounts carry a placeholder address that is never shown or emailed.
    email: isDeliverableEmail(user.email) ? user.email : null,
    roles: actor.roles,
    isStaff: actor.isStaff,
  };
}

export const profilePatchSchema = z
  .object({
    name: z.string().trim().min(2, "validation.name").max(80).optional(),
    preferredLocale: z.enum(LOCALES).optional(),
    email: z.email("validation.email").max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "validation.required" });

/** Name and language change immediately; an email change is returned so the caller can start verification. */
export async function updateProfile(actor: Actor | null, input: unknown) {
  requireUser(actor);
  const { email, ...data } = parse(profilePatchSchema, input);
  if (Object.keys(data).length) await db.user.update({ where: { id: actor.userId }, data });
  return { updated: Object.keys(data), emailChangeRequested: email ?? null };
}

// ───────────── Notifications ─────────────

export async function listNotifications(actor: Actor | null, locale: Locale, opts: { cursor?: string | null; limit?: number; unreadOnly?: boolean } = {}) {
  requireUser(actor);
  const take = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const rows = await db.inAppNotification.findMany({
    where: { userId: actor.userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, take);
  return {
    items: page.map((n) => {
      const msg = render(n.titleKey as NotificationType, locale, (n.params ?? {}) as Record<string, string>);
      return { id: n.id, type: n.titleKey, title: msg.title, body: msg.body, href: n.href ? `/${locale}${n.href}` : null, readAt: n.readAt, createdAt: n.createdAt };
    }),
    nextCursor: rows.length > take ? page[page.length - 1].id : null,
  };
}

export async function unreadCount(actor: Actor | null) {
  requireUser(actor);
  return { unread: await db.inAppNotification.count({ where: { userId: actor.userId, readAt: null } }) };
}

export const markReadSchema = z.union([z.object({ ids: z.array(z.string().max(40)).min(1).max(100) }), z.object({ all: z.literal(true) })]);

export async function markNotificationsRead(actor: Actor | null, input: unknown) {
  requireUser(actor);
  const body = parse(markReadSchema, input);
  const res = await db.inAppNotification.updateMany({
    where: { userId: actor.userId, readAt: null, ...("ids" in body ? { id: { in: body.ids } } : {}) },
    data: { readAt: new Date() },
  });
  return { marked: res.count };
}

// ───────────── Preferences & consents ─────────────

export async function getPreferences(actor: Actor | null) {
  requireUser(actor);
  const rows = await db.notificationPreference.findMany({ where: { userId: actor.userId } });
  const off = new Set(rows.filter((r) => !r.enabled).map((r) => r.channel));
  return { channels: [{ channel: "in_app", enabled: true, optional: false }, ...OPTIONAL_CHANNELS.map((c) => ({ channel: c, enabled: !off.has(c), optional: true }))] };
}

export const preferencesSchema = z.object({
  channels: z
    .array(z.object({ channel: z.enum(OPTIONAL_CHANNELS as unknown as [Channel, ...Channel[]]), enabled: z.boolean() }))
    .min(1)
    .max(OPTIONAL_CHANNELS.length),
});

export async function updatePreferences(actor: Actor | null, input: unknown) {
  requireUser(actor);
  const { channels } = parse(preferencesSchema, input);
  await db.$transaction(
    channels.map(({ channel, enabled }) =>
      db.notificationPreference.upsert({ where: { userId_channel: { userId: actor.userId, channel } }, create: { userId: actor.userId, channel, enabled }, update: { enabled } }),
    ),
  );
  return getPreferences(actor);
}

export async function listConsents(actor: Actor | null) {
  requireUser(actor);
  return db.consentRecord.findMany({
    where: { userId: actor.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, policyVersion: true, granted: true, createdAt: true },
  });
}

// ───────────── Activity & tracking ─────────────

export type ActivityType = "repair" | "order" | "customization";

const hrefFor = (locale: Locale, type: ActivityType, reference: string) =>
  `/${locale}/account/${type === "repair" ? "bookings" : type === "order" ? "orders" : "designs"}/${reference}`;

function statusLabel(locale: Locale, type: ActivityType, status: string) {
  const t = createT(locale);
  const key = type === "repair" ? `status.job.${status}` : `activity.${type}Status.${status}`;
  const label = t(key);
  if (label !== key) return label;
  const bookingKey = `status.booking.${status}`;
  return type === "repair" && t(bookingKey) !== bookingKey ? t(bookingKey) : status;
}

/** Latest repairs, product order requests and customization requests in one feed (FR-ACCOUNT-04). */
export async function listActivity(actor: Actor | null, locale: Locale, limit = 20) {
  requireUser(actor);
  const take = Math.min(Math.max(limit, 1), 50);
  const [bookings, orders, designs] = await Promise.all([
    db.repairBooking.findMany({
      where: { customerId: actor.userId },
      orderBy: { updatedAt: "desc" },
      take,
      select: { reference: true, status: true, updatedAt: true, createdAt: true, model: { select: { name: true, brand: { select: { name: true } } } }, job: { select: { status: true, updatedAt: true } } },
    }),
    db.productRequest.findMany({
      where: { customerId: actor.userId },
      orderBy: { updatedAt: "desc" },
      take,
      select: { reference: true, status: true, updatedAt: true, createdAt: true, _count: { select: { items: true } } },
    }),
    db.customizationRequest.findMany({
      where: { customerId: actor.userId },
      orderBy: { updatedAt: "desc" },
      take,
      select: { reference: true, status: true, updatedAt: true, createdAt: true, deviceModel: { select: { name: true, brand: { select: { name: true } } } } },
    }),
  ]);

  const items = [
    ...bookings.map((b) => {
      const status = b.job?.status ?? b.status;
      const updatedAt = b.job && b.job.updatedAt > b.updatedAt ? b.job.updatedAt : b.updatedAt;
      return { type: "repair" as const, reference: b.reference, status, statusLabel: statusLabel(locale, "repair", status), title: `${b.model.brand.name} ${b.model.name}`, createdAt: b.createdAt, updatedAt, href: hrefFor(locale, "repair", b.reference) };
    }),
    ...orders.map((o) => ({
      type: "order" as const,
      reference: o.reference,
      status: o.status,
      statusLabel: statusLabel(locale, "order", o.status),
      title: createT(locale)("activity.orderTitle", { count: o._count.items }),
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      href: hrefFor(locale, "order", o.reference),
    })),
    ...designs.map((d) => ({
      type: "customization" as const,
      reference: d.reference,
      status: d.status,
      statusLabel: statusLabel(locale, "customization", d.status),
      title: `${d.deviceModel.brand.name} ${d.deviceModel.name}`,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      href: hrefFor(locale, "customization", d.reference),
    })),
  ];
  return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, take);
}

/** Reference prefixes: repair `TN-YYMM-00001`, order `TN-P-YYMM-00001`, customization `TN-C-YYMM-00001`. */
export function referenceType(reference: string): ActivityType | null {
  const r = reference.trim().toUpperCase();
  if (/^TN-P-\d{4}-\d{5,}$/.test(r)) return "order";
  if (/^TN-C-\d{4}-\d{5,}$/.test(r)) return "customization";
  if (/^TN-\d{4}-\d{5,}$/.test(r)) return "repair";
  return null;
}

type TimelineEntry = { status: string; label: string; reason: string | null; at: Date };

/**
 * Track any request the caller owns by reference. Unknown references and other customers'
 * references both resolve to NOT_FOUND so references cannot be probed (IDOR).
 */
export async function trackReference(actor: Actor | null, locale: Locale, rawReference: string) {
  requireUser(actor);
  const reference = rawReference.trim().toUpperCase();
  const type = referenceType(reference);
  if (!type) throw notFound("request");
  const t = createT(locale);

  if (type === "repair") {
    const b = await db.repairBooking.findFirst({
      where: { reference, customerId: actor.userId },
      select: { id: true, reference: true, status: true, createdAt: true, updatedAt: true, model: { select: { name: true, brand: { select: { name: true } } } }, job: { select: { status: true, previousStatus: true, updatedAt: true } } },
    });
    if (!b) throw notFound("request");
    const history = await db.repairStatusHistory.findMany({ where: { bookingId: b.id, customerVisible: true }, orderBy: { createdAt: "asc" } });
    const timeline: TimelineEntry[] = history.map((h) => ({
      status: h.toStatus,
      label: statusLabel(locale, "repair", h.toStatus),
      reason: h.reason,
      at: h.createdAt,
    }));
    const step = customerStep(b.status, b.job?.status ?? null, b.job?.previousStatus);
    const status = b.job?.status ?? b.status;
    return {
      type,
      reference: b.reference,
      status,
      statusLabel: statusLabel(locale, "repair", status),
      title: `${b.model.brand.name} ${b.model.name}`,
      steps: CUSTOMER_STEPS.map((s, i) => ({ key: s, label: t(`tracking.steps.${s}`), done: i < CUSTOMER_STEPS.indexOf(step), current: s === step })),
      timeline,
      createdAt: b.createdAt,
      updatedAt: b.job?.updatedAt ?? b.updatedAt,
      href: hrefFor(locale, type, b.reference),
    };
  }

  if (type === "order") {
    const o = await db.productRequest.findFirst({
      where: { reference, customerId: actor.userId },
      select: { reference: true, status: true, createdAt: true, updatedAt: true, trackingInfo: true, history: { where: { customerVisible: true }, orderBy: { createdAt: "asc" } }, _count: { select: { items: true } } },
    });
    if (!o) throw notFound("request");
    const flow = ["SUBMITTED", "CONFIRMED", "FULFILLING", "SHIPPED", "COMPLETED"];
    const idx = flow.indexOf(o.status);
    return {
      type,
      reference: o.reference,
      status: o.status,
      statusLabel: statusLabel(locale, "order", o.status),
      title: t("activity.orderTitle", { count: o._count.items }),
      trackingInfo: o.trackingInfo,
      steps: flow.map((s, i) => ({ key: s, label: statusLabel(locale, "order", s), done: idx >= 0 && i < idx, current: s === o.status })),
      timeline: o.history.map((h) => ({ status: h.toStatus, label: statusLabel(locale, "order", h.toStatus), reason: h.reason, at: h.createdAt })),
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      href: hrefFor(locale, type, o.reference),
    };
  }

  const c = await db.customizationRequest.findFirst({
    where: { reference, customerId: actor.userId },
    select: { reference: true, status: true, createdAt: true, updatedAt: true, quotedPaise: true, deviceModel: { select: { name: true, brand: { select: { name: true } } } }, history: { where: { customerVisible: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!c) throw notFound("request");
  const flow = ["SUBMITTED", "UNDER_REVIEW", "FEASIBILITY_CONFIRMED", "QUOTE_SHARED", "ACCEPTED", "COMPLETED"];
  const idx = flow.indexOf(c.status);
  return {
    type,
    reference: c.reference,
    status: c.status,
    statusLabel: statusLabel(locale, "customization", c.status),
    title: `${c.deviceModel.brand.name} ${c.deviceModel.name}`,
    quotedPaise: c.quotedPaise,
    steps: flow.map((s, i) => ({ key: s, label: statusLabel(locale, "customization", s), done: idx >= 0 && i < idx, current: s === c.status })),
    timeline: c.history.map((h) => ({ status: h.toStatus, label: statusLabel(locale, "customization", h.toStatus), reason: h.reason, at: h.createdAt })),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    href: hrefFor(locale, "customization", c.reference),
  };
}
