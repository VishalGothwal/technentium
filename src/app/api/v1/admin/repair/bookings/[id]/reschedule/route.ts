import { api, jsonBody } from "@/server/http";
import { rescheduleBooking } from "@/server/modules/repairs/booking.service";

/** POST /api/v1/admin/repair/bookings/{id}/reschedule — body { slotId, reason }. */
export const POST = api<RouteContext<"/api/v1/admin/repair/bookings/[id]/reschedule">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  const body = (await jsonBody(req)) as { slotId?: string; reason?: string };
  await rescheduleBooking(actor, id, body.slotId ?? "", body.reason ?? "");
  return { rescheduled: true };
});
