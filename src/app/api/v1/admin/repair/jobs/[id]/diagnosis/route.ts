import { api, jsonBody } from "@/server/http";
import { recordDiagnosis } from "@/server/modules/repairs/job.service";

/** POST /api/v1/admin/repair/jobs/{id}/diagnosis */
export const POST = api<RouteContext<"/api/v1/admin/repair/jobs/[id]/diagnosis">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  await recordDiagnosis(actor, id, await jsonBody(req));
  return { saved: true };
});
