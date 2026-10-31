import { api, jsonBody } from "@/server/http";
import { confirmBooking } from "@/server/modules/repairs/booking.service";

/** POST /api/v1/admin/repair/bookings/{id}/confirm — body { technicianId? }. Requires booking.confirm. */
export const POST = api<RouteContext<"/api/v1/admin/repair/bookings/[id]/confirm">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  const body = (await jsonBody(req)) as { technicianId?: string };
  await confirmBooking(actor, id, { technicianId: body.technicianId ?? null });
  return { confirmed: true };
});
