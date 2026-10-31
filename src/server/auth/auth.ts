import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { bearer, phoneNumber, twoFactor } from "better-auth/plugins";
import { db } from "@/server/db";
import { emailAdapter, isDeliverableEmail, PLACEHOLDER_EMAIL_DOMAIN } from "@/server/providers/email";
import { smsAdapter, testOtpHooks } from "@/server/providers/sms";
import { hit } from "@/server/rate-limit";
import { testHooksEnabled } from "@/server/test-hooks";
import { isValidIndianMobile, normalizeIndianMobile } from "@/lib/phone";

export const OTP_EXPIRY_SECONDS = 300;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

/** "Continue with Google" is offered only when OAuth credentials are configured (free in Google Cloud Console). */
const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, prompt: "select_account" as const } }
    : undefined;

export const auth = betterAuth({
  appName: "Technentium",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily while active
  },

  socialProviders: google,
  // A Google sign-in with the same verified email as an existing account joins that account instead of failing.
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },

  user: {
    additionalFields: {
      preferredLocale: { type: "string", required: false, defaultValue: "en", input: true },
    },
    changeEmail: { enabled: true },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 30,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }) {
      if (!isDeliverableEmail(user.email)) return;
      await emailAdapter().send({
        to: user.email,
        subject: "Reset your Technentium password",
        text: `Use this link within 30 minutes to reset your password:\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      if (!isDeliverableEmail(user.email)) return;
      await emailAdapter().send({
        to: user.email,
        subject: "Verify your email for Technentium",
        text: `Confirm your email address:\n\n${url}`,
      });
    },
  },

  // FR-AUTH-04 / §13.1: rate-limit auth endpoints. Database storage so limits hold across serverless instances.
  rateLimit: {
    enabled: !testHooksEnabled(),
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 300, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
      "/phone-number/send-otp": { window: OTP_RESEND_COOLDOWN_SECONDS, max: 1 },
      "/phone-number/verify": { window: 60, max: 10 },
      "/two-factor/verify-totp": { window: 60, max: 10 },
    },
  },

  plugins: [
    phoneNumber({
      otpLength: 6,
      expiresIn: OTP_EXPIRY_SECONDS,
      allowedAttempts: 5,
      phoneNumberValidator: (p) => isValidIndianMobile(p),
      signUpOnVerification: {
        getTempEmail: (p) => `${normalizeIndianMobile(p)?.replace("+", "") ?? p}@${PLACEHOLDER_EMAIL_DOMAIN}`,
        getTempName: () => "Customer",
      },
      async sendOTP({ phoneNumber: phone, code }) {
        // Per-phone limit on top of Better Auth's per-IP limit: 5 codes per hour.
        if (!(await hit(`otp:${phone}`, 3600, 5))) {
          throw new APIError("TOO_MANY_REQUESTS", { message: "Too many codes requested for this number. Try again later." });
        }
        testOtpHooks.record(phone, code);
        await smsAdapter().sendOtp(phone, code);
      },
    }),
    twoFactor({ issuer: "Technentium" }),
    // Mobile apps: every sign-in response carries `set-auth-token`; send it back as `Authorization: Bearer <token>`.
    // Only signed tokens are accepted, so a raw session id can never be replayed as a bearer token.
    bearer({ requireSignature: true }),
    nextCookies(), // must stay last
  ],

  databaseHooks: {
    user: {
      create: {
        async after(user) {
          await db.customerProfile.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
        },
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
