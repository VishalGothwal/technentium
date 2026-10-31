import { api } from "@/server/http";
import { cancelMyProductRequest } from "@/server/modules/shop/request.service";

/** POST /api/v1/account/product-requests/{reference}/cancel — allowed only while SUBMITTED. */
export const POST = api<RouteContext<"/api/v1/account/product-requests/[reference]/cancel">>(async (_req, ctx, actor) => {
  const { reference } = await ctx.params;
  return cancelMyProductRequest(actor, reference);
});
