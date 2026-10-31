import { api, jsonBody } from "@/server/http";
import { addProductRequestNote } from "@/server/modules/shop/request.service";

/** POST /api/v1/admin/product-requests/{id}/notes — `{ body, customerVisible }`; customer-visible notes notify the customer. */
export const POST = api<RouteContext<"/api/v1/admin/product-requests/[id]/notes">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  return addProductRequestNote(actor, id, await jsonBody(req));
});
