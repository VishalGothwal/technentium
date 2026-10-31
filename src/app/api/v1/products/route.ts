import { api } from "@/server/http";
import { listProducts } from "@/server/modules/shop/catalog.service";

/** GET /api/v1/products?q=&category=&deviceModelId=&sort=&inStock=&page=&pageSize= — public, paginated. */
export const GET = api(async (req) => listProducts(Object.fromEntries(req.nextUrl.searchParams)));
