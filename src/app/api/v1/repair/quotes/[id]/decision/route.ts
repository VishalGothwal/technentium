import { api, jsonBody } from "@/server/http";
import { decideQuote } from "@/server/modules/quotes/quote.service";

/** POST /api/v1/repair/quotes/{versionId}/decision — `{ decision: "APPROVED" }` or a decline with return method. */
export const POST = api<RouteContext<"/api/v1/repair/quotes/[id]/decision">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  return decideQuote(actor, id, await jsonBody(req));
});
