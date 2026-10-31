import { api } from "@/server/http";
import { listCategories } from "@/server/modules/catalog/catalog.service";

/** GET /api/v1/devices/categories — public. */
export const GET = api(async () => listCategories());
