/**
 * Explicit repair lifecycle (PRD §6.3). Pure data + functions — no database access — so the
 * whole table is unit-tested. Database-dependent guards (e.g. "an approved decision exists")
 * are named here and evaluated by job.service.
 *
 * The status set is provisional until operations sign it off (reference video pending);
 * changing the flow should only require editing this table and the translation files.
 */
import type { BookingStatus, JobStatus } from "@/generated/prisma/enums";

export type NotificationType =
  | "booking.submitted"
  | "booking.confirmed"
  | "booking.declined"
  | "booking.needs_info"
  | "booking.rescheduled"
  | "booking.cancelled"
  | "job.device_received"
  | "job.repair_started"
  | "job.on_hold"
  | "job.ready_for_return"
  | "job.completed"
  | "quote.sent"
  | "quote.reminder"
  | "quote.approved"
  | "quote.declined"
  | "quote.expired"
  // Protection-product order requests (PRD §6.6)
  | "order.submitted"
  | "order.confirmed"
  | "order.declined"
  | "order.shipped"
  | "order.completed"
  | "order.cancelled"
  | "order.updated"
  // Customization requests (PRD §6.7)
  | "custom.submitted"
  | "custom.needs_info"
  | "custom.quote_shared"
  | "custom.updated"
  | "custom.completed"
  | "custom.declined";

/**
 * Who may perform a transition:
 * - staff: holder of `job.transition`
 * - technician: holder of `job.transition_assigned` who is actively assigned to the job
 * - system: only reachable through a domain service (quote send/decision, booking cancel), never the generic endpoint
 */
export type TransitionActor = "staff" | "technician" | "system";

export type Guard = "approvedQuote" | "passedQualityCheck" | "returnHandedOver" | "inspectionRecorded";

export type JobRule = {
  from: readonly JobStatus[];
  to: JobStatus;
  by: readonly TransitionActor[];
  customerVisible: boolean;
  notify?: NotificationType;
  guard?: Guard;
  requiresReason?: boolean;
};

export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = ["COMPLETED", "CANCELLED"];

const ACTIVE_STATUSES: readonly JobStatus[] = [
  "AWAITING_HANDOVER",
  "DEVICE_RECEIVED",
  "INSPECTION",
  "QUOTE_PREPARED",
  "AWAITING_DECISION",
  "APPROVED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY_FOR_RETURN",
  "AWAITING_CUSTOMER_RESPONSE",
  "QUOTE_DECLINED",
  "RETURN_COORDINATION",
];

export const JOB_RULES: readonly JobRule[] = [
  { from: ["AWAITING_HANDOVER"], to: "DEVICE_RECEIVED", by: ["staff", "technician"], customerVisible: true, notify: "job.device_received" },
  { from: ["DEVICE_RECEIVED"], to: "INSPECTION", by: ["staff", "technician"], customerVisible: true },
  // Draft quote created by the quote service once inspection is recorded.
  { from: ["INSPECTION"], to: "QUOTE_PREPARED", by: ["system"], customerVisible: false, guard: "inspectionRecorded" },
  // Quote sent → waiting on the customer.
  { from: ["QUOTE_PREPARED"], to: "AWAITING_DECISION", by: ["system"], customerVisible: true, notify: "quote.sent" },
  // Revision: a new draft supersedes the sent version; fresh approval is required (FR-QUOTE-08).
  { from: ["AWAITING_DECISION", "AWAITING_CUSTOMER_RESPONSE", "IN_PROGRESS"], to: "QUOTE_PREPARED", by: ["system"], customerVisible: false },
  // Customer decisions.
  { from: ["AWAITING_DECISION"], to: "APPROVED", by: ["system"], customerVisible: true, notify: "quote.approved", guard: "approvedQuote" },
  { from: ["AWAITING_DECISION"], to: "QUOTE_DECLINED", by: ["system"], customerVisible: true, notify: "quote.declined" },
  // Expiry / no response (D-07).
  { from: ["AWAITING_DECISION"], to: "AWAITING_CUSTOMER_RESPONSE", by: ["system", "staff"], customerVisible: true, notify: "quote.expired" },
  // Repair.
  { from: ["APPROVED"], to: "IN_PROGRESS", by: ["staff", "technician"], customerVisible: true, notify: "job.repair_started", guard: "approvedQuote" },
  { from: ["IN_PROGRESS"], to: "QUALITY_CHECK", by: ["staff", "technician"], customerVisible: true },
  { from: ["QUALITY_CHECK"], to: "IN_PROGRESS", by: ["staff", "technician"], customerVisible: false, requiresReason: true },
  { from: ["QUALITY_CHECK"], to: "READY_FOR_RETURN", by: ["staff", "technician"], customerVisible: true, notify: "job.ready_for_return", guard: "passedQualityCheck" },
  // Decline / no-response path → return unrepaired (FR-QUOTE-12).
  { from: ["QUOTE_DECLINED"], to: "RETURN_COORDINATION", by: ["system"], customerVisible: true },
  { from: ["AWAITING_CUSTOMER_RESPONSE"], to: "RETURN_COORDINATION", by: ["staff"], customerVisible: true, requiresReason: true },
  { from: ["RETURN_COORDINATION"], to: "READY_FOR_RETURN", by: ["staff"], customerVisible: true, notify: "job.ready_for_return" },
  // Handover.
  { from: ["READY_FOR_RETURN"], to: "COMPLETED", by: ["staff", "technician"], customerVisible: true, notify: "job.completed", guard: "returnHandedOver" },
  // Cancellation before the device is with us.
  { from: ["AWAITING_HANDOVER"], to: "CANCELLED", by: ["system"], customerVisible: true },
  // Hold from any active state; resuming is handled by `resumeTarget`.
  { from: ACTIVE_STATUSES, to: "ON_HOLD", by: ["staff"], customerVisible: true, notify: "job.on_hold", requiresReason: true },
];

export function findJobRule(from: JobStatus, to: JobStatus): JobRule | undefined {
  return JOB_RULES.find((r) => r.to === to && r.from.includes(from));
}

/** ON_HOLD resumes only to the status it was put on hold from. */
export function resumeTarget(status: JobStatus, previousStatus: JobStatus | null): JobStatus | null {
  return status === "ON_HOLD" && previousStatus ? previousStatus : null;
}

export type TransitionContext = {
  hasStaffTransition: boolean; // job.transition
  hasAssignedTransition: boolean; // job.transition_assigned
  isAssigned: boolean;
  system: boolean; // called from a domain service
};

export function actorMayApply(rule: JobRule, ctx: TransitionContext): boolean {
  if (ctx.system && rule.by.includes("system")) return true;
  if (rule.by.includes("staff") && ctx.hasStaffTransition) return true;
  if (rule.by.includes("technician") && ctx.hasAssignedTransition && ctx.isAssigned) return true;
  return false;
}

/** Transitions a given actor can trigger manually from the admin UI (buttons / Kanban drops). */
export function manualTargets(from: JobStatus, previousStatus: JobStatus | null, ctx: Omit<TransitionContext, "system">): JobStatus[] {
  const targets = JOB_RULES.filter((r) => r.from.includes(from) && !r.by.every((b) => b === "system"))
    .filter((r) => actorMayApply(r, { ...ctx, system: false }))
    .map((r) => r.to);
  const resume = resumeTarget(from, previousStatus);
  if (resume && ctx.hasStaffTransition) targets.push(resume);
  return targets;
}

// ───────────── Booking (pre-job) states ─────────────

export type BookingRule = {
  from: readonly BookingStatus[];
  to: BookingStatus;
  by: readonly ("staff" | "customer")[];
  requiresReason: boolean;
  notify?: NotificationType;
};

export const BOOKING_RULES: readonly BookingRule[] = [
  { from: ["SUBMITTED"], to: "CONFIRMED", by: ["staff"], requiresReason: false, notify: "booking.confirmed" },
  { from: ["SUBMITTED", "NEEDS_INFO"], to: "DECLINED", by: ["staff"], requiresReason: true, notify: "booking.declined" },
  { from: ["SUBMITTED"], to: "NEEDS_INFO", by: ["staff"], requiresReason: true, notify: "booking.needs_info" },
  { from: ["NEEDS_INFO"], to: "SUBMITTED", by: ["customer"], requiresReason: false },
  { from: ["SUBMITTED", "NEEDS_INFO"], to: "CANCELLED", by: ["customer", "staff"], requiresReason: false, notify: "booking.cancelled" },
  // Staff may cancel a confirmed booking while the device has not been handed over (job → CANCELLED).
  { from: ["CONFIRMED"], to: "CANCELLED", by: ["staff"], requiresReason: true, notify: "booking.cancelled" },
];

export function findBookingRule(from: BookingStatus, to: BookingStatus): BookingRule | undefined {
  return BOOKING_RULES.find((r) => r.to === to && r.from.includes(from));
}

/** Customer-facing progress steps for the tracking timeline (FR-REPAIR-09). */
export const CUSTOMER_STEPS = ["submitted", "confirmed", "received", "diagnosis", "decision", "repair", "ready", "completed"] as const;
export type CustomerStep = (typeof CUSTOMER_STEPS)[number];

export function customerStep(booking: BookingStatus, job: JobStatus | null, previousJobStatus?: JobStatus | null): CustomerStep {
  if (!job) return booking === "CONFIRMED" ? "confirmed" : "submitted";
  const effective = job === "ON_HOLD" && previousJobStatus ? previousJobStatus : job;
  switch (effective) {
    case "AWAITING_HANDOVER":
    case "CANCELLED":
      return "confirmed";
    case "DEVICE_RECEIVED":
      return "received";
    case "INSPECTION":
    case "QUOTE_PREPARED":
      return "diagnosis";
    case "AWAITING_DECISION":
    case "AWAITING_CUSTOMER_RESPONSE":
    case "QUOTE_DECLINED":
    case "RETURN_COORDINATION": // declined: no repair step, the device goes back after the decision
      return "decision";
    case "APPROVED":
    case "IN_PROGRESS":
    case "QUALITY_CHECK":
      return "repair";
    case "READY_FOR_RETURN":
      return "ready";
    case "COMPLETED":
      return "completed";
    default:
      return "received";
  }
}
