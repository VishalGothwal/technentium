import { api } from "@/server/http";
import { notFound } from "@/server/errors";
import { getSpecDetail } from "@/server/modules/content/content.public";
import { publicJson } from "@/server/modules/content/api-helpers";

/** GET /api/v1/content/devices/{slug} — published specification sheet. `value: null` means "not available" (FR-SPEC-04). */
export const GET = api<RouteContext<"/api/v1/content/devices/[slug]">>(async (_req, ctx) => {
  const { slug } = await ctx.params;
  const spec = await getSpecDetail(slug);
  if (!spec) throw notFound("device");
  return publicJson(spec);
});
