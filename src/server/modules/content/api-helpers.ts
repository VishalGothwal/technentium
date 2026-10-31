import "server-only";
import type { NextRequest } from "next/server";
import { isLocale, type Locale } from "@/i18n/config";

/** Locale for public content APIs: `?locale=` wins, then Accept-Language, then English. */
export function apiLocale(req: NextRequest): Locale {
  const q = req.nextUrl.searchParams.get("locale");
  if (isLocale(q)) return q;
  const header = req.headers.get("accept-language")?.slice(0, 2);
  return isLocale(header) ? header : "en";
}

/** Public, cacheable JSON (published content is the same for every viewer). */
export function publicJson(data: unknown) {
  return Response.json({ data }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=600" } });
}

/** `?ids=a,b,c` → sanitised list. */
export function idList(raw: string | null, max = 3) {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[\w-]{1,120}$/.test(s))
    .slice(0, max);
}
