import { api, jsonBody } from "@/server/http";
import { recordInspection } from "@/server/modules/repairs/job.service";

/** POST /api/v1/admin/repair/jobs/{id}/inspection — receipt condition. */
export const POST = api<RouteContext<"/api/v1/admin/repair/jobs/[id]/inspection">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  await recordInspection(actor, id, await jsonBody(req));
  return { saved: true };
});
