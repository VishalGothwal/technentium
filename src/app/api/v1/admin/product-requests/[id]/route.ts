import { api } from "@/server/http";
import { getProductRequestForStaff } from "@/server/modules/shop/request.service";

/** GET /api/v1/admin/product-requests/{id} — full request with history and notes. */
export const GET = api<RouteContext<"/api/v1/admin/product-requests/[id]">>(async (_req, ctx, actor) => {
  const { id } = await ctx.params;
  return getProductRequestForStaff(actor, id);
});
