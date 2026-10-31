import { api } from "@/server/http";
import { listIssues } from "@/server/modules/catalog/catalog.service";

/** GET /api/v1/repair/issues?categoryId= — public. */
export const GET = api(async (req) => {
  const categoryId = req.nextUrl.searchParams.get("categoryId");
  return categoryId ? listIssues(categoryId) : [];
});
