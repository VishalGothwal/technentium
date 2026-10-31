import { api } from "@/server/http";
import { getDesign } from "@/server/modules/customization/customization.service";

/** GET /api/v1/designs/{id or slug} — public. */
export const GET = api<RouteContext<"/api/v1/designs/[id]">>(async (_req, ctx) => getDesign((await ctx.params).id));
