import { api } from "@/server/http";
import { listBrands } from "@/server/modules/catalog/catalog.service";

/** GET /api/v1/devices/brands?categoryId= | ?category=phone — public; brands with model counts. */
export const GET = api(async (req) => {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("categoryId");
  const slug = sp.get("category");
  return id || slug ? listBrands({ id, slug }) : [];
});
