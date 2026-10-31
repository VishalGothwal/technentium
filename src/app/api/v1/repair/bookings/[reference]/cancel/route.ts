import { api } from "@/server/http";
import { cancelMyBooking } from "@/server/modules/repairs/booking.service";

/** POST /api/v1/repair/bookings/{reference}/cancel — customer cancels before confirmation. */
export const POST = api<RouteContext<"/api/v1/repair/bookings/[reference]/cancel">>(async (_req, ctx, actor) => {
  const { reference } = await ctx.params;
  await cancelMyBooking(actor, reference);
  return { cancelled: true };
});
