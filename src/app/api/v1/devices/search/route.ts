import { api } from "@/server/http";
import { searchDevices } from "@/server/modules/catalog/catalog.service";

const int = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

/**
 * GET /api/v1/devices/search?q=&category=&categoryId=&brand=&year=&limit=&offset= — public.
 * Popular models when there is no query, brand or year.
 */
export const GET = api(async (req) => {
  const sp = req.nextUrl.searchParams;
  return searchDevices({
    q: sp.get("q"),
    categoryId: sp.get("categoryId"),
    category: sp.get("category"),
    brand: sp.get("brand"),
    year: int(sp.get("year")),
    limit: int(sp.get("limit")) ?? 24,
    offset: int(sp.get("offset")) ?? 0,
  });
});
