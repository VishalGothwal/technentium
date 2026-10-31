import { api, jsonBody } from "@/server/http";
import { transitionCustomization } from "@/server/modules/customization/customization.service";

/** POST /api/v1/admin/customization-requests/{id}/status — `{ to, reason }`; staff with `customization.manage`. */
export const POST = api<RouteContext<"/api/v1/admin/customization-requests/[id]/status">>(async (req, ctx, actor) =>
  transitionCustomization(actor, (await ctx.params).id, await jsonBody(req)),
);
