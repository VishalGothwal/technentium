import { api } from "@/server/http";
import { getCustomizationForStaff } from "@/server/modules/customization/customization.service";

/** GET /api/v1/admin/customization-requests/{id} — full request for staff. */
export const GET = api<RouteContext<"/api/v1/admin/customization-requests/[id]">>(async (_req, ctx, actor) => getCustomizationForStaff(actor, (await ctx.params).id));
