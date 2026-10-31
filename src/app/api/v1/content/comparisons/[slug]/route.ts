import { api } from "@/server/http";
import { notFound } from "@/server/errors";
import { alignSpecs } from "@/lib/content/specs";
import { getComparisonDetail } from "@/server/modules/content/content.public";
import { publicJson } from "@/server/modules/content/api-helpers";

/** GET /api/v1/content/comparisons/{slug} — curated comparison with its devices and aligned spec rows. */
export const GET = api<RouteContext<"/api/v1/content/comparisons/[slug]">>(async (_req, ctx) => {
  const { slug } = await ctx.params;
  const c = await getComparisonDetail(slug);
  if (!c) throw notFound("content");
  return publicJson({ ...c, rows: alignSpecs(c.devices.map((d) => d.specs)) });
});
