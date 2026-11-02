import "server-only";
import type { AuthError, SupabaseClient, User as AuthUser } from "@supabase/supabase-js";
import { headers } from "next/headers";
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
): Promise<AuthResult<{ needsTotp: boolean }>> {
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

  if (opts.staff) {
    const staff = await db.staffProfile.findUnique({
      where: { userId: done.userId },
      select: { active: true },
    });
    if (!staff?.active) {
      await supabase.auth.signOut();
      return fail("auth.notStaff");
    }
  }
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    ok: true,
    needsTotp: aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2",
  };
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
  if (!(await hit(`otp:${phone}`, 3600, 5)) || !(await hit(`otp-30s:${phone}`, 30, 1))) return fail("auth.tooMany");

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
export async function startGoogleSignIn(next: string): Promise<AuthResult<{ url: string }>> {
  if (!supabaseConfigured()) return fail("auth.notConfigured");
  if (!(await getFeatures()).signIn.google) return fail("auth.methodOff");
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
  if (!(await hit(`reset:${email}`, 300, 3))) return fail("auth.tooMany");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackUrl(`/${locale}/auth/reset-password`),
  });
  if (error && mapError(error, "errors.generic") === "auth.tooMany") return fail("auth.tooMany");
  return { ok: true };
}

/** Sets a new password for the session opened by a reset link (or any signed-in session). */
export async function setNewPassword(password: string): Promise<AuthResult> {
  if (password.length < 8 || password.length > 128) return fail("auth.weakPassword");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("auth.resetInvalid");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(mapError(error, "auth.resetInvalid"));
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

// ───────────── Two-factor (TOTP via Supabase MFA) ─────────────

async function syncTwoFactorFlag(supabase: SupabaseClient) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data } = await supabase.auth.mfa.listFactors();
  const on = (data?.totp ?? []).some((f) => f.status === "verified");
  await db.user.updateMany({
    where: { authUserId: u.user.id },
    data: { twoFactorEnabled: on },
  });
}

/** Second sign-in step: lifts the session to aal2 with a code from the authenticator app. */
export async function verifyTotp(code: string): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail("auth.failed");
  if (!(await hit(`totp:${u.user.id}`, 60, 10))) return fail("auth.tooMany");
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp.find((f) => f.status === "verified");
  if (!factor) return fail("auth.codeInvalid");
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: code.trim(),
  });
  if (error) return fail(mapError(error, "auth.codeInvalid"));
  return { ok: true };
}

/** Starts authenticator setup after re-checking the password. Returns the otpauth URI and secret to show. */
export async function startTotpEnrollment(password: string): Promise<AuthResult<{ factorId: string; uri: string; secret: string; qr: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user?.email) return fail("auth.failed");
  if (!(await hit(`totp-enroll:${u.user.id}`, 300, 5))) return fail("auth.tooMany");
  if (!(await passwordMatches(u.user.email, password))) return fail("auth.wrongPassword");
  // Drop abandoned setups so the new one can be created.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Technentium",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) return fail("errors.generic");
  return {
    ok: true,
    factorId: data.id,
    uri: data.totp.uri,
    secret: data.totp.secret,
    qr: data.totp.qr_code,
  };
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim(),
  });
  if (error) return fail(mapError(error, "auth.codeInvalid"));
  await syncTwoFactorFlag(supabase);
  return { ok: true };
}

export async function disableTotp(password: string): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user?.email) return fail("auth.failed");
  if (!(await passwordMatches(u.user.email, password))) return fail("auth.wrongPassword");
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return fail(mapError(error, "errors.generic"));
  }
  await syncTwoFactorFlag(supabase);
  return { ok: true };
}
