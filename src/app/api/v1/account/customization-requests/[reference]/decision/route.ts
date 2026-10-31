import { api, jsonBody } from "@/server/http";
import { decideCustomizationQuote } from "@/server/modules/customization/customization.service";

/** POST /api/v1/account/customization-requests/{reference}/decision — accept or decline the shared price. */
export const POST = api<RouteContext<"/api/v1/account/customization-requests/[reference]/decision">>(async (req, ctx, actor) =>
  decideCustomizationQuote(actor, (await ctx.params).reference, await jsonBody(req)),
);
