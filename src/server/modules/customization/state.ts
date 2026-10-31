/**
 * Customization request lifecycle (PRD §6.7 proposed statuses; pending operational validation).
 * Pure data + functions so the table is unit-tested; the service applies it with compare-and-set.
 */
import type { CustomizationStatus } from "@/generated/prisma/enums";
import type { NotificationType } from "@/server/modules/repairs/state-machine";

export type CustomizationActorKind = "staff" | "customer";

export type CustomizationRule = {
  from: readonly CustomizationStatus[];
  to: CustomizationStatus;
  by: readonly CustomizationActorKind[];
  requiresReason: boolean;
  notify?: NotificationType;
  /** Only reachable through a dedicated service call (e.g. sharing a price), never the generic transition. */
  dedicated?: "quote" | "reply" | "decision";
};

export const TERMINAL_CUSTOMIZATION_STATUSES: readonly CustomizationStatus[] = ["DECLINED", "COMPLETED", "CANCELLED"];
/** Customers may withdraw until a price has been shared. */
export const CUSTOMER_CANCELLABLE: readonly CustomizationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO"];
const REVIEWABLE: readonly CustomizationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO", "FEASIBILITY_CONFIRMED"];

export const CUSTOMIZATION_RULES: readonly CustomizationRule[] = [
  { from: ["SUBMITTED", "NEEDS_INFO"], to: "UNDER_REVIEW", by: ["staff"], requiresReason: false, notify: "custom.updated" },
  { from: ["SUBMITTED", "UNDER_REVIEW", "FEASIBILITY_CONFIRMED"], to: "NEEDS_INFO", by: ["staff"], requiresReason: true, notify: "custom.needs_info" },
  // The customer's reply re-opens review.
  { from: ["NEEDS_INFO"], to: "UNDER_REVIEW", by: ["customer"], requiresReason: false, dedicated: "reply" },
  { from: ["SUBMITTED", "UNDER_REVIEW"], to: "FEASIBILITY_CONFIRMED", by: ["staff"], requiresReason: false, notify: "custom.updated" },
  // Sharing (or revising) a price.
  { from: ["UNDER_REVIEW", "FEASIBILITY_CONFIRMED", "QUOTE_SHARED"], to: "QUOTE_SHARED", by: ["staff"], requiresReason: false, notify: "custom.quote_shared", dedicated: "quote" },
  // Customer decision on the shared price.
  { from: ["QUOTE_SHARED"], to: "ACCEPTED", by: ["customer"], requiresReason: false, notify: "custom.updated", dedicated: "decision" },
  { from: ["QUOTE_SHARED"], to: "DECLINED", by: ["customer"], requiresReason: false, notify: "custom.updated", dedicated: "decision" },
  { from: ["ACCEPTED"], to: "COMPLETED", by: ["staff"], requiresReason: false, notify: "custom.completed" },
  { from: REVIEWABLE, to: "DECLINED", by: ["staff"], requiresReason: true, notify: "custom.declined" },
  { from: CUSTOMER_CANCELLABLE, to: "CANCELLED", by: ["customer"], requiresReason: false, notify: "custom.updated" },
  { from: [...REVIEWABLE, "QUOTE_SHARED", "ACCEPTED"], to: "CANCELLED", by: ["staff"], requiresReason: true, notify: "custom.updated" },
];

export function findCustomizationRule(from: CustomizationStatus, to: CustomizationStatus, by: CustomizationActorKind, dedicated?: CustomizationRule["dedicated"]) {
  return CUSTOMIZATION_RULES.find((r) => r.to === to && r.from.includes(from) && r.by.includes(by) && r.dedicated === dedicated);
}

/** Targets a staff member can pick from the generic status menu in the admin console. */
export function staffTargets(from: CustomizationStatus): CustomizationStatus[] {
  return CUSTOMIZATION_RULES.filter((r) => r.by.includes("staff") && !r.dedicated && r.from.includes(from)).map((r) => r.to);
}

export const canShareQuote = (status: CustomizationStatus) => !!findCustomizationRule(status, "QUOTE_SHARED", "staff", "quote");

/** Customer-facing tracking steps. */
export const CUSTOMIZATION_STEPS = ["submitted", "review", "quote", "accepted", "completed"] as const;
export type CustomizationStep = (typeof CUSTOMIZATION_STEPS)[number];

export function customizationStep(status: CustomizationStatus): CustomizationStep {
  switch (status) {
    case "SUBMITTED":
      return "submitted";
    case "UNDER_REVIEW":
    case "NEEDS_INFO":
    case "FEASIBILITY_CONFIRMED":
      return "review";
    case "QUOTE_SHARED":
      return "quote";
    case "ACCEPTED":
      return "accepted";
    case "COMPLETED":
      return "completed";
    default:
      return "submitted";
  }
}

export const CUSTOMIZATION_TONE: Record<CustomizationStatus, "neutral" | "primary" | "success" | "warning" | "danger" | "info"> = {
  SUBMITTED: "info",
  UNDER_REVIEW: "primary",
  NEEDS_INFO: "warning",
  FEASIBILITY_CONFIRMED: "primary",
  QUOTE_SHARED: "warning",
  ACCEPTED: "success",
  DECLINED: "danger",
  COMPLETED: "success",
  CANCELLED: "neutral",
};
