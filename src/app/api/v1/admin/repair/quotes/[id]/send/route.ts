import { api } from "@/server/http";
import { sendQuote } from "@/server/modules/quotes/quote.service";

/** POST /api/v1/admin/repair/quotes/{versionId}/send */
export const POST = api<RouteContext<"/api/v1/admin/repair/quotes/[id]/send">>(async (_req, ctx, actor) => {
  const { id } = await ctx.params;
  await sendQuote(actor, id);
  return { sent: true };
});
