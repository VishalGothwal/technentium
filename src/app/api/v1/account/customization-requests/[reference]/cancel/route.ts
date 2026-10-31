import { api, jsonBody } from "@/server/http";
import { cancelMyCustomization } from "@/server/modules/customization/customization.service";

/** POST /api/v1/account/customization-requests/{reference}/cancel — withdraw the request before a price is shared. */
export const POST = api<RouteContext<"/api/v1/account/customization-requests/[reference]/cancel">>(async (req, ctx, actor) =>
  cancelMyCustomization(actor, (await ctx.params).reference, await jsonBody(req)),
);
