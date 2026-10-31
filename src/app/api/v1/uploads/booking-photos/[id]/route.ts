import { api } from "@/server/http";
import { removeDraftPhoto } from "@/server/modules/repairs/attachment.service";

/** DELETE /api/v1/uploads/booking-photos/{id} — remove a photo not yet attached to a booking. */
export const DELETE = api<RouteContext<"/api/v1/uploads/booking-photos/[id]">>(async (_req, ctx, actor) => {
  const { id } = await ctx.params;
  await removeDraftPhoto(actor, id);
  return { removed: true };
});
