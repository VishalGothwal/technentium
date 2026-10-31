import { api } from "@/server/http";
import { getMyCustomization } from "@/server/modules/customization/customization.service";

/** GET /api/v1/account/customization-requests/{reference} — detail with customer-visible history and notes. */
export const GET = api<RouteContext<"/api/v1/account/customization-requests/[reference]">>(async (_req, ctx, actor) =>
  getMyCustomization(actor, (await ctx.params).reference),
);
