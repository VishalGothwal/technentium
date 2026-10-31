import { api } from "@/server/http";
import { listModels } from "@/server/modules/catalog/catalog.service";

/** GET /api/v1/devices/models?brandId= — public. */
export const GET = api(async (req) => {
  const brandId = req.nextUrl.searchParams.get("brandId");
  return brandId ? listModels(brandId) : [];
});
