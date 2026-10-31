import { api } from "@/server/http";
import { getSpecBrands, getSpecList } from "@/server/modules/content/content.public";
import { publicJson } from "@/server/modules/content/api-helpers";

/** GET /api/v1/content/specs?q=&brand= — devices with published specifications, plus brand filters. */
export const GET = api(async (req) => {
  const sp = req.nextUrl.searchParams;
  const [items, brands] = await Promise.all([getSpecList({ q: sp.get("q")?.slice(0, 80), brand: sp.get("brand")?.slice(0, 40) }), getSpecBrands()]);
  return publicJson({ items, brands });
});
