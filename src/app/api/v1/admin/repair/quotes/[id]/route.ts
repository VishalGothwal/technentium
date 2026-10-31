import { api, jsonBody } from "@/server/http";
import { saveDraft } from "@/server/modules/quotes/quote.service";

/** PUT /api/v1/admin/repair/quotes/{versionId} — body { lines, customerMessage }; returns server-computed totals. */
export const PUT = api<RouteContext<"/api/v1/admin/repair/quotes/[id]">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  return saveDraft(actor, id, await jsonBody(req));
});
