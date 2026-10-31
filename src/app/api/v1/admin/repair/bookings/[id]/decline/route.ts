import { api, jsonBody } from "@/server/http";
import { declineBooking } from "@/server/modules/repairs/booking.service";

/** POST /api/v1/admin/repair/bookings/{id}/decline — body { reason }. */
export const POST = api<RouteContext<"/api/v1/admin/repair/bookings/[id]/decline">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  const body = (await jsonBody(req)) as { reason?: string };
  await declineBooking(actor, id, body.reason ?? "");
  return { declined: true };
});
