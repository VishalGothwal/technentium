import { api } from "@/server/http";
import { listProductCategories } from "@/server/modules/shop/catalog.service";

/** GET /api/v1/product-categories — public, with active product counts. */
export const GET = api(async () => (await listProductCategories()).map(({ _count, ...c }) => ({ ...c, productCount: _count.products })));
