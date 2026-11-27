import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthError, SupabaseClient, User as AuthUser } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { db } from "@/server/db";
import { getFeatures } from "@/server/features";
import { hit } from "@/server/rate-limit";
import { createSupabaseServerClient, createSupabaseStatelessClient, supabaseConfigured } from "@/server/supabase/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/server/supabase/admin";
import { normalizeIndianMobile } from "@/lib/phone";
import { safeNext } from "@/lib/safe-redirect";
import { writeViewAsCookie } from "./impersonation";
import { appUserIdFor, syncContact } from "./provision";

/**
 * Sign-in flows on top of Supabase Auth. They run on the server (called from Server Actions) so the Owner's
 * feature switches, rate limits, blocked accounts and account linking all apply before a session is kept.
 * Errors are i18n keys the forms show as-is.
 */
export type AuthErrorKey =
  | "auth.tooMany"
  | "auth.failed"
  | "auth.emailNotVerified"
  | "auth.otpFailed"
  | "auth.sendFailed"
  | "auth.methodOff"
  | "auth.signUpOff"
  | "auth.blocked"
  | "auth.emailTaken"
  | "auth.notConfigured"
  | "auth.resetInvalid"
  | "auth.googleFailed"
  | "auth.weakPassword"
  | "auth.notStaff"
  | "auth.codeInvalid"
  | "auth.wrongPassword"
  | "validation.phone"
  | "errors.generic";

export type AuthResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: AuthErrorKey };

const fail = (error: AuthErrorKey) => ({ ok: false as const, error });

export const appOrigin = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
/** Where Supabase sends people back after Google, email confirmation and password-reset links. */
export const authCallbackUrl = (next: string) => `${appOrigin()}/api/auth/callback?next=${encodeURIComponent(next)}`;

const RATE_CODES = new Set(["over_request_rate_limit", "over_sms_send_rate_limit", "over_email_send_rate_limit"]);
function mapError(e: AuthError, fallback: AuthErrorKey): AuthErrorKey {
  if (e.status === 429 || (e.code && RATE_CODES.has(e.code))) return "auth.tooMany";
  if (e.code === "email_not_confirmed") return "auth.emailNotVerified";
  if (e.code === "user_banned") return "auth.blocked";
  if (e.code === "weak_password") return "auth.weakPassword";
  if (e.code === "signup_disabled" || e.code === "otp_disabled") return "auth.signUpOff";
  return fallback;
}

async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * After Supabase accepted the credentials: link or create the app account, refuse blocked accounts and
 * closed sign-ups, and refresh the stored email/phone. Signs the session out again on refusal.
 */
export async function completeSignIn(supabase: SupabaseClient, user?: AuthUser | null): Promise<AuthResult<{ userId: string }>> {
  const u = user ?? (await supabase.auth.getUser()).data.user;
  if (!u) return fail("auth.failed");
  const userId = await appUserIdFor(u.id, async () => u);
  if (!userId) {
    await supabase.auth.signOut();
    // Sign-ups are closed: don't leave an orphan Supabase user from a Google sign-in behind.
    if (supabaseAdminConfigured() && Date.now() - new Date(u.created_at).getTime() < 10 * 60_000) {
      await supabaseAdmin()
        .auth.admin.deleteUser(u.id)
        .catch(() => {});
    }
    return fail("auth.signUpOff");
  }
  const app = await db.user.findUnique({
    where: { id: userId },
    select: { blockedAt: true },
  });
  if (app?.blockedAt) {
    await supabase.auth.signOut();
    return fail("auth.blocked");
  }
  await syncContact(userId, u);
  return { ok: true, userId };
}

// ───────────── Customer sign-in ─────────────

export async function signInWithPassword(
  input: { email: string; password: string },
  opts: { staff?: boolean } = {},
): Promise<AuthResult> {
  if (!supabaseConfigured()) return fail("auth.notConfigured");
  if (!opts.staff && !(await getFeatures()).signIn.emailPassword) return fail("auth.methodOff");
  const email = input.email.trim().toLowerCase();
  if (!(await hit(`signin:${email}`, 60, 10)) || !(await hit(`signin-ip:${await clientIp()}`, 60, 30))) return fail("auth.tooMany");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error) return fail(mapError(error, "auth.failed"));
  const done = await completeSignIn(supabase, data.user);
  if (!done.ok) return done;

  if (opts.staff) return requireStaff(supabase, done.userId);
  return { ok: true };
}

/** Admin console sign-ins (password or Google): only active staff keep the session. */
export async function requireStaff(supabase: SupabaseClient, userId: string): Promise<AuthResult> {
  const staff = await db.staffProfile.findUnique({
    where: { userId },
    select: { active: true },
  });
  if (!staff?.active) {
    await supabase.auth.signOut();
    return fail("auth.notStaff");
  }
  return { ok: true };
}

export async function signUpWithPassword(input: {
  name: string;
  email: string;
  password: string;
  locale: string;
  next: string;
}): Promise<AuthResult<{ needsConfirmation: boolean }>> {
  if (!supabaseConfigured()) return fail("auth.notConfigured");
  const features = await getFeatures();
  if (!features.signIn.emailPassword) return fail("auth.methodOff");
  if (!features.signUp) return fail("auth.signUpOff");
  if (!(await hit(`signup-ip:${await clientIp()}`, 300, 5))) return fail("auth.tooMany");

  const email = input.email.trim().toLowerCase();
  if (
    await db.user.findFirst({
      where: { email, authUserId: { not: null } },
      select: { id: true },
    })
  )
    return fail("auth.emailTaken");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { full_name: input.name.trim(), locale: input.locale },
      emailRedirectTo: authCallbackUrl(safeNext(input.next, `/${input.locale}/account`)),
    },
  });
  if (error) return fail(error.code === "user_already_exists" || error.code === "email_exists" ? "auth.emailTaken" : mapError(error, "errors.generic"));
  // With email confirmation on, an existing address comes back as a user with no identities.
  if (data.user && data.user.identities?.length === 0) return fail("auth.emailTaken");
  if (!data.session) return { ok: true, needsConfirmation: true };
  const done = await completeSignIn(supabase, data.user);
  return done.ok ? { ok: true, needsConfirmation: false } : done;
}

export async function sendPhoneOtp(rawPhone: string): Promise<AuthResult> {
  if (!supabaseConfigured()) return fail("auth.notConfigured");
  const features = await getFeatures();
  if (!features.signIn.phoneOtp) return fail("auth.methodOff");
  const phone = normalizeIndianMobile(rawPhone);
  if (!phone) return fail("validation.phone");
  // Per-number limit on top of Supabase's own: 5 codes per hour, one per 30 seconds.
  // Per IP too, so a script can't buy SMS for thousands of numbers. Loose because mobile carriers share IPs (CGNAT).
  if (!(await hit(`otp:${phone}`, 3600, 5)) || !(await hit(`otp-30s:${phone}`, 30, 1)) || !(await hit(`otp-ip:${await clientIp()}`, 3600, 30))) return fail("auth.tooMany");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: features.signUp },
  });
  if (error) {
    console.warn(`[auth] send OTP failed: ${error.code ?? error.status} ${error.message}`);
    return fail(error.code === "otp_disabled" || error.code === "signup_disabled" ? "auth.signUpOff" : mapError(error, "auth.sendFailed"));
  }
  return { ok: true };
}

export async function verifyPhoneOtp(rawPhone: string, code: string): Promise<AuthResult> {
  if (!supabaseConfigured()) return fail("auth.notConfigured");
  const phone = normalizeIndianMobile(rawPhone);
  if (!phone) return fail("validation.phone");
  if (!/^\d{6}$/.test(code.trim())) return fail("auth.otpFailed");
  if (!(await hit(`otp-verify:${phone}`, 300, 10))) return fail("auth.tooMany");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: code.trim(),
    type: "sms",
  });
  if (error) return fail(mapError(error, "auth.otpFailed"));
  return completeSignIn(supabase, data.user);
}

/** Starts Google sign-in. Returns the Google URL; the PKCE verifier is kept in a cookie for the callback. */
/** `staff`: the admin console's button, which (like staff password sign-in) ignores the customer switch; the callback checks staff access. */
export async function startGoogleSignIn(next: string, opts: { staff?: boolean } = {}): Promise<AuthResult<{ url: string }>> {
  if (!supabaseConfigured()) return fail("auth.notConfigured");
  if (!opts.staff && !(await getFeatures()).signIn.google) return fail("auth.methodOff");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authCallbackUrl(safeNext(next, "/en/account")),
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) return fail("auth.googleFailed");
  return { ok: true, url: data.url };
}

/** Always "sent" so addresses can't be probed; only rate limits surface. */
export async function requestPasswordReset(rawEmail: string, locale: string): Promise<AuthResult> {
  if (!supabaseConfigured()) return fail("auth.notConfigured");
  const email = rawEmail.trim().toLowerCase();
  if (!(await hit(`reset:${email}`, 300, 3)) || !(await hit(`reset-ip:${await clientIp()}`, 3600, 20))) return fail("auth.tooMany");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackUrl(`/${locale}/auth/reset-password`),
  });
  if (error && mapError(error, "errors.generic") === "auth.tooMany") return fail("auth.tooMany");
  return { ok: true };
}

/**
 * Reset and invite links set this signed, 30-minute cookie in the callback. Without it a signed-in session must use
 * `changePassword` (current password required), so an unlocked browser can't silently take over the account.
 * No SUPABASE_SECRET_KEY (local dev): not enforced.
 */
const RESET_COOKIE = "tn_pw_reset";
const resetSig = (authUserId: string, exp: string) =>
  createHmac("sha256", `technentium:pw-reset:${process.env.SUPABASE_SECRET_KEY}`).update(`${authUserId}.${exp}`).digest("base64url");

export async function grantPasswordReset(authUserId: string) {
  const exp = String(Date.now() + 30 * 60_000);
  (await cookies()).set(RESET_COOKIE, `${exp}.${resetSig(authUserId, exp)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 60 });
}

async function hasPasswordReset(authUserId: string) {
  if (!process.env.SUPABASE_SECRET_KEY) return true;
  const [exp = "", sig = ""] = ((await cookies()).get(RESET_COOKIE)?.value ?? "").split(".");
  const expected = Buffer.from(resetSig(authUserId, exp));
  return Number(exp) > Date.now() && sig.length === expected.length && timingSafeEqual(Buffer.from(sig), expected);
}

/** Sets a new password for the session opened by a reset or invite link. */
export async function setNewPassword(password: string): Promise<AuthResult> {
  if (password.length < 8 || password.length > 128) return fail("auth.weakPassword");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !(await hasPasswordReset(data.user.id))) return fail("auth.resetInvalid");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(mapError(error, "auth.resetInvalid"));
  (await cookies()).delete(RESET_COOKIE);
  return { ok: true };
}

/**
 * Staff two-factor: an authenticator-app code (TOTP, Supabase MFA). `users.twoFactorEnabled` records that it is on,
 * so every request can enforce it (session.ts getRealActor) without asking Supabase.
 */
export async function startTotpEnrolment(): Promise<AuthResult<{ factorId: string; qrCode: string; secret: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  // A set-up that was started but never confirmed would block a new one.
  for (const f of factors?.all ?? []) if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Technentium ${Date.now()}` });
  if (error) return fail(mapError(error, "errors.generic"));
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Check a code: confirms a new factor (`factorId` from enrolment) or completes sign-in with the existing one. */
export async function verifyTotp(code: string, factorId?: string): Promise<AuthResult> {
  if (!/^\d{6}$/.test(code.trim())) return fail("auth.codeInvalid");
  const supabase = await createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail("auth.failed");
  if (!(await hit(`mfa:${u.user.id}`, 300, 10))) return fail("auth.tooMany");
  let id = factorId;
  if (!id) {
    const { data } = await supabase.auth.mfa.listFactors();
    id = data?.totp[0]?.id;
    // The factor was deleted in the Supabase dashboard (lost phone): two-factor is off for this account.
    if (!id) {
      await db.user.updateMany({ where: { authUserId: u.user.id }, data: { twoFactorEnabled: false } });
      return { ok: true };
    }
  }
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code: code.trim() });
  if (error) return fail(error.status === 429 ? "auth.tooMany" : "auth.codeInvalid");
  await db.user.updateMany({ where: { authUserId: u.user.id }, data: { twoFactorEnabled: true } });
  return { ok: true };
}

/**
 * Start an email change for the signed-in browser session: Supabase emails a confirmation link to the new
 * address, and the app copy updates when it is followed (via /api/auth/callback).
 */
export async function requestEmailChange(newEmail: string, returnTo: string): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("auth.failed");
  if (!(await hit(`email-change:${data.user.id}`, 3600, 5))) return fail("auth.tooMany");
  const email = newEmail.trim().toLowerCase();
  if (
    await db.user.findFirst({
      where: { email, NOT: { authUserId: data.user.id } },
      select: { id: true },
    })
  )
    return fail("auth.emailTaken");
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: authCallbackUrl(returnTo) });
  if (error) return fail(error.code === "email_exists" ? "auth.emailTaken" : mapError(error, "errors.generic"));
  return { ok: true };
}

/** Checks the current password without touching this browser's session. */
async function passwordMatches(email: string, password: string) {
  const { error } = await createSupabaseStatelessClient().auth.signInWithPassword({
    email,
    password,
  });
  return !error;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
  if (newPassword.length < 8 || newPassword.length > 128) return fail("auth.weakPassword");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return fail("auth.failed");
  if (!(await hit(`pw-change:${data.user.id}`, 300, 5))) return fail("auth.tooMany");
  if (!(await passwordMatches(data.user.email, currentPassword))) return fail("auth.wrongPassword");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return fail(mapError(error, "errors.generic"));
  // Other devices sign in again with the new password.
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true };
}

export async function signOut(): Promise<AuthResult> {
  await writeViewAsCookie(null);
  if (!supabaseConfigured()) return { ok: true };
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return { ok: true };
}
