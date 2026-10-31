import { api } from "@/server/http";
import { getMyProductRequest } from "@/server/modules/shop/request.service";

/** GET /api/v1/account/product-requests/{reference} — tracking detail. Another customer's reference returns 404. */
export const GET = api<RouteContext<"/api/v1/account/product-requests/[reference]">>(async (_req, ctx, actor) => {
  const { reference } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...request } = await getMyProductRequest(actor, reference);
  return request;
});
