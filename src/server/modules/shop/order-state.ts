/**
 * Product order-request lifecycle (PRD §6.6 FR-PROD-07). Pure data + functions so it is unit-tested.
 * A request is never "paid" in this phase: staff confirm availability and shipping before fulfilment.
 */
import type { ProductRequestStatus } from "@/generated/prisma/enums";
import type { NotificationType } from "@/server/modules/repairs/state-machine";

export type OrderRule = {
  from: readonly ProductRequestStatus[];
  to: ProductRequestStatus;
  by: readonly ("staff" | "customer")[];
  requiresReason: boolean;
  notify: NotificationType;
};

export const ORDER_RULES: readonly OrderRule[] = [
  { from: ["SUBMITTED"], to: "CONFIRMED", by: ["staff"], requiresReason: false, notify: "order.confirmed" },
  { from: ["SUBMITTED"], to: "DECLINED", by: ["staff"], requiresReason: true, notify: "order.declined" },
  { from: ["SUBMITTED"], to: "CANCELLED", by: ["customer", "staff"], requiresReason: false, notify: "order.cancelled" },
  { from: ["CONFIRMED"], to: "CANCELLED", by: ["staff"], requiresReason: true, notify: "order.cancelled" },
  { from: ["CONFIRMED"], to: "FULFILLING", by: ["staff"], requiresReason: false, notify: "order.updated" },
  { from: ["FULFILLING"], to: "SHIPPED", by: ["staff"], requiresReason: false, notify: "order.shipped" },
  { from: ["SHIPPED"], to: "COMPLETED", by: ["staff"], requiresReason: false, notify: "order.completed" },
];

export const TERMINAL_ORDER_STATUSES: readonly ProductRequestStatus[] = ["COMPLETED", "DECLINED", "CANCELLED"];

export function findOrderRule(from: ProductRequestStatus, to: ProductRequestStatus): OrderRule | undefined {
  return ORDER_RULES.find((r) => r.to === to && r.from.includes(from));
}

/** Staff actions available from a status (drives the admin action panel). */
export const staffTargets = (from: ProductRequestStatus) => ORDER_RULES.filter((r) => r.from.includes(from) && r.by.includes("staff")).map((r) => r.to);

/** Customer-facing tracking steps; declined/cancelled are shown as a banner instead. */
export const ORDER_STEPS = ["SUBMITTED", "CONFIRMED", "FULFILLING", "SHIPPED", "COMPLETED"] as const;
export type OrderStep = (typeof ORDER_STEPS)[number];

export function orderStepIndex(status: ProductRequestStatus): number {
  return (ORDER_STEPS as readonly string[]).indexOf(status);
}

// ───────────── Money & stock helpers ─────────────

export function lineTotal(unitPricePaise: number, quantity: number) {
  return unitPricePaise * quantity;
}

export function subtotalOf(lines: { unitPricePaise: number; quantity: number }[]) {
  return lines.reduce((sum, l) => sum + lineTotal(l.unitPricePaise, l.quantity), 0);
}

/** Whole-number discount percentage from MRP, or null when there is no real discount. */
export function discountPercent(pricePaise: number, mrpPaise: number | null | undefined): number | null {
  if (!mrpPaise || mrpPaise <= pricePaise) return null;
  const pct = Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
  return pct >= 1 ? pct : null;
}

export type StockLevel = "in_stock" | "low_stock" | "out_of_stock" | "unknown";

/** FR-PROD-04/11: availability shown to customers ("where known"). */
export function stockLevel(onHand: number | null | undefined, lowThreshold: number): StockLevel {
  if (onHand === null || onHand === undefined) return "unknown";
  if (onHand <= 0) return "out_of_stock";
  if (onHand <= lowThreshold) return "low_stock";
  return "in_stock";
}

/** Total after confirmation: confirmed quantities at the snapshot prices plus shipping. */
export function confirmedTotal(items: { unitPricePaise: number; quantity: number; confirmedQuantity: number }[], shippingPaise: number) {
  return items.reduce((sum, i) => sum + i.unitPricePaise * i.confirmedQuantity, 0) + shippingPaise;
}
