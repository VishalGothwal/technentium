import { api, jsonBody } from "@/server/http";
import { shareCustomizationQuote } from "@/server/modules/customization/customization.service";

/** POST /api/v1/admin/customization-requests/{id}/quote — `{ quotedPaise, message }` → QUOTE_SHARED. */
export const POST = api<RouteContext<"/api/v1/admin/customization-requests/[id]/quote">>(async (req, ctx, actor) =>
  shareCustomizationQuote(actor, (await ctx.params).id, await jsonBody(req)),
);
