import { api } from "@/server/http";
import { listProductTypes } from "@/server/modules/shop/catalog.service";

/** GET /api/v1/product-types?category= — public; types (HD+, Privacy, Anti-yellow…) with comparison scores and product counts. */
export const GET = api(async (req) => listProductTypes(req.nextUrl.searchParams.get("category")));
