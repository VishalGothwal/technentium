import { api } from "@/server/http";
import { openDraft } from "@/server/modules/quotes/quote.service";

/** POST /api/v1/admin/repair/jobs/{id}/quotes — open (or return) the editable draft; supersedes a sent version. */
export const POST = api<RouteContext<"/api/v1/admin/repair/jobs/[id]/quotes">>(async (_req, ctx, actor) => {
  const { id } = await ctx.params;
  return { versionId: await openDraft(actor, id) };
});
