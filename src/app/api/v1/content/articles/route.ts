import { api } from "@/server/http";
import { parse } from "@/server/validation";
import { listContentQuerySchema } from "@/lib/schemas/content";
import { getContentList } from "@/server/modules/content/content.public";
import { apiLocale, publicJson } from "@/server/modules/content/api-helpers";

/** GET /api/v1/content/articles?topic=&tag=&q=&page=&pageSize=&locale= — published articles, newest first. */
export const GET = api(async (req) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const query = parse(listContentQuerySchema, { ...sp, type: "ARTICLE" });
  return publicJson(await getContentList(apiLocale(req), query));
});
