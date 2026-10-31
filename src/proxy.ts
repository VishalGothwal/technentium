import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n/config";

/**
 * Locale routing for the customer site: `/repairs` → `/{locale}/repairs`.
 * Preference order: saved cookie → Accept-Language (Hindi if preferred) → English.
 * Admin, API and static assets are not localised.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];

  if (isLocale(first)) {
    const res = NextResponse.next();
    if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
      res.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return res;
  }

  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const acceptsHindi = /(^|,)\s*hi\b/i.test(request.headers.get("accept-language") ?? "");
  const locale = isLocale(cookie) ? cookie : acceptsHindi ? "hi" : DEFAULT_LOCALE;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|admin|_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
