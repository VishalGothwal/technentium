import { api } from "@/server/http";
import { notFound } from "@/server/errors";
import { getContentDetail } from "@/server/modules/content/content.public";
import { apiLocale, publicJson } from "@/server/modules/content/api-helpers";

/**
 * GET /api/v1/content/articles/{slug}?locale= — one published article with its block body and related links.
 * `isFallback: true` when the requested language isn't published and English is returned instead.
 */
export const GET = api<RouteContext<"/api/v1/content/articles/[slug]">>(async (req, ctx) => {
  const { slug } = await ctx.params;
  const detail = await getContentDetail("ARTICLE", slug, apiLocale(req));
  if (!detail) throw notFound("content");
  return publicJson(detail);
});
