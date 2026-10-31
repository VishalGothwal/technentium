import type { NotificationType } from "@/server/modules/repairs/state-machine";

export const CHANNELS = ["in_app", "email", "sms", "whatsapp"] as const;
export type Channel = (typeof CHANNELS)[number];

/**
 * Event → channel matrix (decision D-11, proposed default; pending approval).
 * Every customer-facing event goes to in-app + email. SMS/WhatsApp are limited to the
 * milestones where the customer must act or come in, to control provider cost.
 * SMS and WhatsApp adapters are console stubs until providers are chosen.
 */
export const NOTIFICATION_MATRIX: Record<NotificationType, readonly Channel[]> = {
  "booking.submitted": ["in_app", "email"],
  "booking.confirmed": ["in_app", "email", "sms", "whatsapp"],
  "booking.declined": ["in_app", "email", "sms"],
  "booking.needs_info": ["in_app", "email", "sms"],
  "booking.rescheduled": ["in_app", "email", "sms", "whatsapp"],
  "booking.cancelled": ["in_app", "email"],
  "job.device_received": ["in_app", "email"],
  "job.repair_started": ["in_app", "email"],
  "job.on_hold": ["in_app", "email"],
  "job.ready_for_return": ["in_app", "email", "sms", "whatsapp"],
  "job.completed": ["in_app", "email"],
  "quote.sent": ["in_app", "email", "sms", "whatsapp"],
  "quote.reminder": ["in_app", "email", "sms"],
  "quote.approved": ["in_app", "email"],
  "quote.declined": ["in_app", "email"],
  "quote.expired": ["in_app", "email"],
  "order.submitted": ["in_app", "email"],
  "order.confirmed": ["in_app", "email", "sms", "whatsapp"],
  "order.declined": ["in_app", "email", "sms"],
  "order.shipped": ["in_app", "email", "sms", "whatsapp"],
  "order.completed": ["in_app", "email"],
  "order.cancelled": ["in_app", "email"],
  "order.updated": ["in_app", "email"],
  "custom.submitted": ["in_app", "email"],
  "custom.needs_info": ["in_app", "email", "sms"],
  "custom.quote_shared": ["in_app", "email", "sms", "whatsapp"],
  "custom.updated": ["in_app", "email"],
  "custom.completed": ["in_app", "email", "sms"],
  "custom.declined": ["in_app", "email"],
};

/** Channels the customer may switch off. In-app is always on so the account history stays complete. */
export const OPTIONAL_CHANNELS: readonly Channel[] = ["email", "sms", "whatsapp"];

export function channelsFor(type: NotificationType, disabled: ReadonlySet<Channel>): Channel[] {
  return NOTIFICATION_MATRIX[type].filter((c) => c === "in_app" || !disabled.has(c));
}
