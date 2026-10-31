import { api, jsonBody } from "@/server/http";
import type { JobStatus } from "@/generated/prisma/enums";
import { transitionJob } from "@/server/modules/repairs/job.service";

/** POST /api/v1/admin/repair/jobs/{id}/status — body { to, reason? }. Transition rules and guards apply. */
export const POST = api<RouteContext<"/api/v1/admin/repair/jobs/[id]/status">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  const body = (await jsonBody(req)) as { to?: JobStatus; reason?: string };
  await transitionJob(actor, id, body.to as JobStatus, body.reason);
  return { status: body.to };
});
