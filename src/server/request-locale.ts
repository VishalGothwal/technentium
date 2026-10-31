import type { NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";

/** Locale for API responses: `?locale=` wins, then `Accept-Language` (en/hi), then English. */
export function requestLocale(req: NextRequest): Locale {
  const q = req.nextUrl.searchParams.get("locale");
  if (isLocale(q)) return q;
  const lang = req.headers.get("accept-language")?.slice(0, 2).toLowerCase();
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}
