import { api } from "@/server/http";
import { getProductBySlug } from "@/server/modules/shop/catalog.service";

/** GET /api/v1/products/{slug} — public product detail with images, specs and compatibility grouped by brand. */
export const GET = api<RouteContext<"/api/v1/products/[slug]">>(async (_req, ctx) => {
  const { slug } = await ctx.params;
  return getProductBySlug(slug);
});
