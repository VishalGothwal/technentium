"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (publishable key, session from the auth cookies). Sign-in itself runs through
 * Server Actions so feature toggles and rate limits apply; use this for client-side reads such as Realtime.
 */
export const createSupabaseBrowserClient = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
