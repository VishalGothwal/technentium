import { api } from "@/server/http";
import { getMyBooking } from "@/server/modules/repairs/booking.service";

/** GET /api/v1/repair/bookings/{reference} — owner only; others get 404. */
export const GET = api<RouteContext<"/api/v1/repair/bookings/[reference]">>(async (_req, ctx, actor) => {
  const { reference } = await ctx.params;
  return getMyBooking(actor, reference);
});
