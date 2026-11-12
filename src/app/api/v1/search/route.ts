import { isLocale } from "@/i18n/config";
import { api } from "@/server/http";
import { siteSearch } from "@/server/modules/search/site-search";

/** GET /api/v1/search?q=&locale= — public header search across phones, specs, products and articles. */
export const GET = api(async (req) => {
  const sp = req.nextUrl.searchParams;
  const locale = sp.get("locale");
  return siteSearch(sp.get("q") ?? "", isLocale(locale) ? locale : "en");
});
