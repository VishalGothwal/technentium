import { api } from "@/server/http";
import { notFound } from "@/server/errors";
import { getContentDetail } from "@/server/modules/content/content.public";
import { apiLocale, publicJson } from "@/server/modules/content/api-helpers";

/** GET /api/v1/content/videos/{slug}?locale= — one published video (videoUrl + body + related links). */
export const GET = api<RouteContext<"/api/v1/content/videos/[slug]">>(async (req, ctx) => {
  const { slug } = await ctx.params;
  const detail = await getContentDetail("VIDEO", slug, apiLocale(req));
  if (!detail) throw notFound("content");
  return publicJson(detail);
});
