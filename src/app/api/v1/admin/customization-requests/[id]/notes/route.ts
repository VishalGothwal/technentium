import { api, jsonBody } from "@/server/http";
import { addCustomizationNote } from "@/server/modules/customization/customization.service";

/** POST /api/v1/admin/customization-requests/{id}/notes — `{ body, visibility: INTERNAL | CUSTOMER }`. */
export const POST = api<RouteContext<"/api/v1/admin/customization-requests/[id]/notes">>(async (req, ctx, actor) =>
  addCustomizationNote(actor, (await ctx.params).id, await jsonBody(req)),
);
