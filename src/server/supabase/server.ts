import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabasePublishableKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** True when the Supabase project is configured; sign-in is unavailable without it. */
export const supabaseConfigured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Supabase client bound to this request's auth cookies (Server Components, Server Actions, Route Handlers).
 * In a Server Component cookies are read-only; the proxy refreshes the session so the write can be skipped.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy keeps the session fresh instead.
        }
      },
    },
  });
}

/**
 * Stateless client (no cookies, no session persistence). Used to verify a mobile app's bearer token and to
 * re-check a password without touching the browser session.
 */
export function createSupabaseStatelessClient(): SupabaseClient {
  return createPlainClient(supabaseUrl(), supabasePublishableKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
