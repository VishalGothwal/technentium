import { api } from "@/server/http";
import { getComparisonList } from "@/server/modules/content/content.public";
import { publicJson } from "@/server/modules/content/api-helpers";

/** GET /api/v1/content/comparisons — curated, published comparisons. */
export const GET = api(async () => publicJson(await getComparisonList()));
