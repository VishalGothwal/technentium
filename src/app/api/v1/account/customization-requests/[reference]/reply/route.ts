import { api, jsonBody } from "@/server/http";
import { replyToCustomizationInfo } from "@/server/modules/customization/customization.service";

/** POST /api/v1/account/customization-requests/{reference}/reply — answer a request for more information. */
export const POST = api<RouteContext<"/api/v1/account/customization-requests/[reference]/reply">>(async (req, ctx, actor) =>
  replyToCustomizationInfo(actor, (await ctx.params).reference, await jsonBody(req)),
);
