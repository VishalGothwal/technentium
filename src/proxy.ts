import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { refreshSupabaseSession } from "@/server/supabase/proxy";

/**
 * 1. Locale routing for the customer site: `/repairs` → `/{locale}/repairs`.
 *    Preference order: saved cookie → Accept-Language (Hindi if preferred) → English.
 * 2. Supabase session refresh for site and admin pages (Server Components can't write cookies).
 * API and static assets are not localised; API routes refresh sessions themselves.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return refreshSupabaseSession(request, () => NextResponse.next({ request }));
  }

  const [, first, second] = pathname.split("/");
  // The admin console is not localised: `/en/admin/...` → `/admin/...`.
  if (isLocale(first) && second === "admin") {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(first.length + 1);
    return NextResponse.redirect(url);
  }
  if (isLocale(first)) {
    return refreshSupabaseSession(request, () => {
      const res = NextResponse.next({ request });
      if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
        res.cookies.set(LOCALE_COOKIE, first, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
      }
      return res;
    });
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
  matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
