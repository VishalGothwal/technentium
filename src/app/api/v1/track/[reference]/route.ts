import { api } from "@/server/http";
import { requestLocale } from "@/server/request-locale";
import { trackReference } from "@/server/modules/account/account.service";

/** GET /api/v1/track/{reference} — status, steps and timeline for any request the caller owns. */
export const GET = api<RouteContext<"/api/v1/track/[reference]">>(async (req, ctx, actor) => {
  const { reference } = await ctx.params;
  return trackReference(actor, requestLocale(req), decodeURIComponent(reference));
});
