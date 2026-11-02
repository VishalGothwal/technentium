import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Refresh the Supabase session in the proxy: Server Components can't write cookies, so an expiring access
 * token is renewed here and the new cookies go to both the page render and the browser.
 * `makeResponse` is called again whenever cookies change so the forwarded request carries them.
 */
export async function refreshSupabaseSession(request: NextRequest, makeResponse: () => NextResponse): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Guests carry no Supabase cookie: nothing to refresh, no network call.
  if (!url || !key || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return makeResponse();

  let response = makeResponse();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = makeResponse();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Validates the token and refreshes it when it is about to expire (writes through setAll above).
  await supabase.auth.getClaims();
  return response;
}
