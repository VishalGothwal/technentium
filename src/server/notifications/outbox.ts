import "server-only";
import { after } from "next/server";
import { db, type Tx } from "@/server/db";
import type { NotificationType } from "@/server/modules/repairs/state-machine";
import { channelsFor, type Channel } from "./matrix";
import { dispatchDeliveries } from "./dispatch";

export type EnqueueInput = {
  type: NotificationType;
  recipientId: string;
  /** Unique per logical event so retries of the business action never create a second notification. */
  dedupeKey: string;
  params: Record<string, string>;
  href?: string;
};

/**
 * Write the event and its pending deliveries inside the business transaction (transactional outbox).
 * Delivery happens after commit, so a provider failure can never undo the booking/quote change
 * (PRD §6.10, §14.2). Returns the event id, or null if this dedupeKey already exists.
 */
export async function enqueue(tx: Tx, input: EnqueueInput): Promise<string | null> {
  const existing = await tx.notificationEvent.findUnique({ where: { dedupeKey: input.dedupeKey }, select: { id: true } });
  if (existing) return null;

  const prefs = await tx.notificationPreference.findMany({ where: { userId: input.recipientId, enabled: false } });
  const disabled = new Set(prefs.map((p) => p.channel as Channel));
  const channels = channelsFor(input.type, disabled);

  const event = await tx.notificationEvent.create({
    data: {
      type: input.type,
      dedupeKey: input.dedupeKey,
      recipientId: input.recipientId,
      payload: { params: input.params, href: input.href ?? null },
      deliveries: { create: channels.map((channel) => ({ channel })) },
    },
  });
  return event.id;
}

/**
 * Schedule delivery of freshly committed events after the response is sent.
 * Anything that fails here stays PENDING/FAILED and is retried by the cron route.
 */
export function dispatchAfterCommit(eventIds: (string | null)[]) {
  const ids = eventIds.filter((x): x is string => !!x);
  if (ids.length === 0) return;
  const run = async () => {
    const deliveries = await db.notificationDelivery.findMany({ where: { eventId: { in: ids }, status: "PENDING" }, select: { id: true } });
    await dispatchDeliveries(deliveries.map((d) => d.id));
  };
  try {
    after(run);
  } catch {
    // Outside a request scope (tests, scripts): the cron sweep will deliver.
  }
}
