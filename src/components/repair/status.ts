/** Badge tone per status, shared by customer and admin views (labels always shown alongside). */
type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export const BOOKING_TONE: Record<string, Tone> = {
  SUBMITTED: "info",
  NEEDS_INFO: "warning",
  CONFIRMED: "primary",
  DECLINED: "danger",
  CANCELLED: "neutral",
  RESCHEDULED: "info",
};

export const JOB_TONE: Record<string, Tone> = {
  AWAITING_HANDOVER: "info",
  DEVICE_RECEIVED: "primary",
  INSPECTION: "primary",
  QUOTE_PREPARED: "primary",
  AWAITING_DECISION: "warning",
  APPROVED: "success",
  IN_PROGRESS: "primary",
  QUALITY_CHECK: "primary",
  READY_FOR_RETURN: "success",
  COMPLETED: "success",
  ON_HOLD: "warning",
  AWAITING_CUSTOMER_RESPONSE: "warning",
  QUOTE_DECLINED: "danger",
  RETURN_COORDINATION: "warning",
  CANCELLED: "neutral",
};

/** One status to show the customer: the job's once it exists, otherwise the booking's. */
export function customerStatus(booking: string, job?: { status: string } | null): { kind: "job" | "booking"; status: string; tone: Tone } {
  if (job && booking === "CONFIRMED") return { kind: "job", status: job.status, tone: JOB_TONE[job.status] ?? "neutral" };
  return { kind: "booking", status: booking, tone: BOOKING_TONE[booking] ?? "neutral" };
}
