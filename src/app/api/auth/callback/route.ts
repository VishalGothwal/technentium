import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { completeSignIn, appOrigin } from "@/server/auth/flows";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { isLocale } from "@/i18n/config";
import { safeNext } from "@/lib/safe-redirect";

const EMAIL_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

/** Reset and invitation links end on the set-password page; the rest continue to the account. */
const SET_PASSWORD_TYPES = new Set(["recovery", "invite"]);

/**
 * Where Supabase returns people from Google sign-in (`?code=`, PKCE) and from email links. Email templates
 * must link here with `?token_hash={{ .TokenHash }}&type=…` (see README): admin-sent reset links and staff
 * invitations don't use PKCE, so the default template would hand the token to the browser only.
 * Opens the session, links the app account, then continues to `next`.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const setsPassword = SET_PASSWORD_TYPES.has(params.get("type") ?? "");
  const next = safeNext(params.get("next"), setsPassword ? "/en/auth/reset-password" : "/en/account");
  const first = next.split("/")[1];
  const locale = isLocale(first) ? first : "en";
  const isReset = setsPassword || next.includes("/auth/reset-password");
  const back = (error: string) =>
    NextResponse.redirect(
      new URL(
        isReset ? `/${locale}/auth/reset-password?error=${error}` : `/${locale}/auth/sign-in?error=${error}&next=${encodeURIComponent(next)}`,
        appOrigin(),
      ),
    );

  if (params.get("error")) return back("link");

  const supabase = await createSupabaseServerClient();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type && EMAIL_TYPES.has(type)
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { data: { user: null }, error: new Error("missing code") };
  if (error || !data.user) return back("link");

  const done = await completeSignIn(supabase, data.user);
  if (!done.ok) return back(done.error === "auth.blocked" ? "blocked" : done.error === "auth.signUpOff" ? "signup" : "link");
  return NextResponse.redirect(new URL(next, appOrigin()));
}
