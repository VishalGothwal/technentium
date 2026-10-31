import "server-only";
import { db } from "@/server/db";
import { emailAdapter, isDeliverableEmail } from "@/server/providers/email";
import { smsAdapter } from "@/server/providers/sms";
import type { NotificationType } from "@/server/modules/repairs/state-machine";
import { render } from "./templates";

export const MAX_ATTEMPTS = 5;
const LEASE_MS = 2 * 60_000;

/** Exponential backoff: 1, 2, 4, 8 minutes. */
export const backoffMs = (attempt: number) => 60_000 * 2 ** Math.max(0, attempt - 1);

type Outcome = { status: "SENT" | "SKIPPED"; provider: string; providerMessageId?: string | null; note?: string };

/**
 * Deliver the given deliveries. Each row is claimed with a conditional update (lease) so the
 * post-commit dispatcher and the cron sweep never send the same delivery twice (FR-NOTIF-05).
 */
export async function dispatchDeliveries(ids: string[]) {
  for (const id of ids) {
    const now = new Date();
    const claimed = await db.notificationDelivery.updateMany({
      where: { id, status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS } },
      data: { nextAttemptAt: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    const delivery = await db.notificationDelivery.findUniqueOrThrow({
      where: { id },
      include: { event: true },
    });

    try {
      const outcome = await deliver(delivery.channel, delivery.event);
      await db.notificationDelivery.update({
        where: { id },
        data: {
          status: outcome.status,
          provider: outcome.provider,
          providerMessageId: outcome.providerMessageId ?? null,
          lastError: outcome.note ?? null,
          sentAt: outcome.status === "SENT" ? new Date() : null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const exhausted = delivery.attempts >= MAX_ATTEMPTS;
      await db.notificationDelivery.update({
        where: { id },
        data: {
          status: "FAILED",
          lastError: message.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + (exhausted ? 365 * 86_400_000 : backoffMs(delivery.attempts))),
        },
      });
      console.error(`[notify] delivery ${id} (${delivery.channel}) failed attempt ${delivery.attempts}: ${message}`);
    }
  }
}

/** Cron sweep: retry due PENDING/FAILED deliveries. */
export async function sweepDeliveries(limit = 100) {
  const due = await db.notificationDelivery.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });
  await dispatchDeliveries(due.map((d) => d.id));
  return due.length;
}

type EventRow = { id: string; type: string; recipientId: string; payload: unknown };

async function deliver(channel: string, event: EventRow): Promise<Outcome> {
  const user = await db.user.findUnique({
    where: { id: event.recipientId },
    select: { email: true, phoneNumber: true, phoneNumberVerified: true, preferredLocale: true },
  });
  if (!user) return { status: "SKIPPED", provider: "none", note: "recipient not found" };

  const payload = event.payload as { params: Record<string, string>; href: string | null };
  const msg = render(event.type as NotificationType, user.preferredLocale, payload.params);

  switch (channel) {
    case "in_app": {
      await db.inAppNotification.upsert({
        where: { eventId: event.id },
        create: {
          userId: event.recipientId,
          eventId: event.id,
          titleKey: event.type,
          bodyKey: event.type,
          params: payload.params,
          href: payload.href,
        },
        update: {},
      });
      return { status: "SENT", provider: "in_app" };
    }
    case "email": {
      if (!isDeliverableEmail(user.email)) return { status: "SKIPPED", provider: "none", note: "no deliverable email" };
      const adapter = emailAdapter();
      const link = payload.href ? `\n\n${process.env.APP_URL ?? ""}${payload.href}` : "";
      const res = await adapter.send({ to: user.email, subject: msg.title, text: `${msg.body}${link}` });
      return { status: "SENT", provider: adapter.name, providerMessageId: res.providerMessageId };
    }
    case "sms":
    case "whatsapp": {
      if (!user.phoneNumber || !user.phoneNumberVerified) return { status: "SKIPPED", provider: "none", note: "no verified phone" };
      // WhatsApp shares the console stub until a BSP and approved templates exist.
      const adapter = smsAdapter();
      if (!adapter.supportsText) return { status: "SKIPPED", provider: adapter.name, note: "SMS provider sends OTP codes only" };
      const res = await adapter.send(user.phoneNumber, `${msg.title}. ${msg.body}`);
      return { status: "SENT", provider: `${adapter.name}:${channel}`, providerMessageId: res.providerMessageId };
    }
    default:
      return { status: "SKIPPED", provider: "none", note: `unknown channel ${channel}` };
  }
}
