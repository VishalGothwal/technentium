import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/server/errors";
import { supabaseUrl } from "./server";

let cached: SupabaseClient | undefined;

export const supabaseAdminConfigured = () => !!process.env.SUPABASE_SECRET_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Supabase Auth admin client (secret key). Server-only: it can create, change and delete any user.
 * Throws a clear configuration error when SUPABASE_SECRET_KEY is missing.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!supabaseAdminConfigured()) throw new AppError("CONFLICT", "errors.supabaseAdminMissing");
  cached ??= createClient(supabaseUrl(), process.env.SUPABASE_SECRET_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}
