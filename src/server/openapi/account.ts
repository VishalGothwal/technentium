import { markReadSchema, preferencesSchema, profilePatchSchema } from "@/server/modules/account/account.service";
import type { PathsObject } from "./types";
import { arr, bool, dateTime, fromZod, int, nullable, obj, pathId, query, str } from "./zod";

const tagAuth = ["Authentication"];
const tagAccount = ["Account"];
const tagApp = ["App"];

const TOKEN_NOTE =
  "On success the response carries a `set-auth-token` header. Store it securely (Keychain / EncryptedSharedPreferences) and send it on every request as `Authorization: Bearer <token>`. Use the header value, not `token` in the body — only signed tokens are accepted.";

const authUser = obj({
  id: str(),
  name: str(),
  email: str("Phone-only accounts have a placeholder address ending in @phone.technentium.invalid"),
  emailVerified: bool(),
  phoneNumber: nullable(str()),
  phoneNumberVerified: nullable(bool()),
  preferredLocale: str(),
  twoFactorEnabled: nullable(bool()),
});
const profile = obj({
  id: str(),
  name: str(),
  email: nullable(str("null for phone-only accounts")),
  emailVerified: bool(),
  phoneNumber: nullable(str()),
  phoneNumberVerified: nullable(bool()),
  preferredLocale: { type: "string", enum: ["en", "hi"] },
  twoFactorEnabled: nullable(bool()),
  roles: arr(str()),
  isStaff: bool(),
  createdAt: dateTime(),
});
const step = obj({ key: str(), label: str(), done: bool(), current: bool() });
const timelineEntry = obj({ status: str(), label: str(), reason: nullable(str()), at: dateTime() });
const activityItem = obj({
  type: { type: "string", enum: ["repair", "order", "customization"] },
  reference: str(),
  status: str(),
  statusLabel: str("Localised per Accept-Language"),
  title: str(),
  createdAt: dateTime(),
  updatedAt: dateTime(),
  href: str("Web page for this request"),
});

/** Authentication (Better Auth endpoints under /api/auth), account, tracking and app bootstrap. */
export const paths: PathsObject = {
  "/api/auth/sign-in/email": {
    post: {
      tags: tagAuth,
      summary: "Sign in with email and password",
      description: `${TOKEN_NOTE} Rate-limited to 10 attempts per minute.`,
      security: "public",
      requestBody: { schema: obj({ email: str(undefined, { format: "email" }), password: str(), rememberMe: bool() }, ["email", "password"]) },
      response: obj({ redirect: bool(), token: str("Unsigned session id — do not use as a bearer token"), user: authUser }),
    },
  },
  "/api/auth/sign-up/email": {
    post: {
      tags: tagAuth,
      summary: "Create an account with email and password",
      description: `Sends a verification email. ${TOKEN_NOTE}`,
      security: "public",
      requestBody: {
        schema: obj({ name: str(), email: str(undefined, { format: "email" }), password: str("8–128 characters", { minLength: 8, maxLength: 128 }), preferredLocale: { type: "string", enum: ["en", "hi"] } }, ["name", "email", "password"]),
      },
      response: obj({ token: nullable(str()), user: authUser }),
    },
  },
  "/api/auth/phone-number/send-otp": {
    post: {
      tags: tagAuth,
      summary: "Send a 6-digit sign-in code by SMS",
      description: "Indian mobile numbers only (`+91XXXXXXXXXX` or 10 digits). One code per 30 seconds per client, at most 5 per number per hour. Codes expire after 5 minutes.",
      security: "public",
      requestBody: { schema: obj({ phoneNumber: str(undefined, { example: "+919812345678" }) }, ["phoneNumber"]) },
      response: obj({ message: str() }),
    },
  },
  "/api/auth/phone-number/verify": {
    post: {
      tags: tagAuth,
      summary: "Verify the code and sign in (creates the account on first use)",
      description: `5 attempts per code. ${TOKEN_NOTE}`,
      security: "public",
      requestBody: { schema: obj({ phoneNumber: str(), code: str(undefined, { pattern: "^\\d{6}$" }) }, ["phoneNumber", "code"]) },
      response: obj({ status: bool(), token: nullable(str()), user: authUser }),
    },
  },
  "/api/auth/get-session": {
    get: { tags: tagAuth, summary: "Current session and user (null when signed out)", security: "bearer", response: nullable(obj({ session: obj({ expiresAt: dateTime() }), user: authUser })) },
  },
  "/api/auth/sign-out": {
    post: { tags: tagAuth, summary: "Sign out (revokes this session/token)", security: "bearer", requestBody: { schema: obj({}) }, response: obj({ success: bool() }) },
  },
  "/api/auth/request-password-reset": {
    post: {
      tags: tagAuth,
      summary: "Email a password reset link",
      description: "Always succeeds so addresses cannot be enumerated. The link opens the web reset page.",
      security: "public",
      requestBody: { schema: obj({ email: str(undefined, { format: "email" }), redirectTo: str("e.g. /en/auth/reset-password") }, ["email"]) },
      response: obj({ status: bool() }),
    },
  },

  "/api/v1/account/profile": {
    get: { tags: tagAccount, summary: "My profile", security: "bearer", response: profile },
    patch: {
      tags: tagAccount,
      summary: "Update name, language or email",
      description: "Name and language apply immediately. A new email is only applied after the user confirms the verification link sent to it (`emailChangePending: true`).",
      security: "bearer",
      requestBody: { schema: fromZod(profilePatchSchema) },
      response: { allOf: [profile, obj({ emailChangePending: bool() })] },
    },
  },
  "/api/v1/account/activity": {
    get: {
      tags: tagAccount,
      summary: "My repairs, orders and design requests",
      description: "One feed across all sections, newest update first.",
      security: "bearer",
      parameters: [query("limit", int(), "1–50, default 20")],
      response: arr(activityItem),
    },
  },
  "/api/v1/account/notifications": {
    get: {
      tags: tagAccount,
      summary: "In-app notifications",
      security: "bearer",
      parameters: [query("cursor", str(), "`nextCursor` from the previous page"), query("limit", int(), "1–50, default 20"), query("unread", str(undefined, { enum: ["1"] }), "Only unread")],
      response: obj({
        items: arr(obj({ id: str(), type: str(), title: str(), body: str(), href: nullable(str()), readAt: nullable(dateTime()), createdAt: dateTime() })),
        nextCursor: nullable(str()),
      }),
    },
  },
  "/api/v1/account/notifications/unread-count": {
    get: { tags: tagAccount, summary: "Unread notification count", security: "bearer", response: obj({ unread: int() }) },
  },
  "/api/v1/account/notifications/read": {
    post: { tags: tagAccount, summary: "Mark notifications as read", security: "bearer", requestBody: { schema: fromZod(markReadSchema) }, response: obj({ marked: int() }) },
  },
  "/api/v1/account/preferences": {
    get: {
      tags: tagAccount,
      summary: "Notification channel preferences",
      security: "bearer",
      response: obj({ channels: arr(obj({ channel: str(), enabled: bool(), optional: bool("In-app cannot be switched off") })) }),
    },
    put: {
      tags: tagAccount,
      summary: "Switch email / SMS / WhatsApp notifications on or off",
      security: "bearer",
      requestBody: { schema: fromZod(preferencesSchema) },
      response: obj({ channels: arr(obj({ channel: str(), enabled: bool(), optional: bool() })) }),
    },
  },
  "/api/v1/account/consents": {
    get: {
      tags: tagAccount,
      summary: "Consent history",
      security: "bearer",
      response: arr(obj({ id: str(), type: str(), policyVersion: str(), granted: bool(), createdAt: dateTime() })),
    },
  },
  "/api/v1/track/{reference}": {
    get: {
      tags: tagAccount,
      summary: "Track a repair, order or design request by reference",
      description: "Accepts `TN-YYMM-00001` (repair), `TN-P-YYMM-00001` (order) and `TN-C-YYMM-00001` (customization). References that are not yours return 404.",
      security: "bearer",
      parameters: [pathId("reference")],
      response: obj({
        type: { type: "string", enum: ["repair", "order", "customization"] },
        reference: str(),
        status: str(),
        statusLabel: str(),
        title: str(),
        steps: arr(step),
        timeline: arr(timelineEntry),
        createdAt: dateTime(),
        updatedAt: dateTime(),
        href: str(),
      }),
    },
  },

  "/api/v1/app/config": {
    get: {
      tags: tagApp,
      summary: "App launch configuration",
      description: "Locales, enabled sections, support contact, minimum supported app version and feature flags.",
      security: "public",
      response: obj({
        locales: arr(str()),
        defaultLocale: str(),
        currency: str(),
        sections: obj({ repairs: bool(), protection: bool(), customization: bool(), articles: bool(), specs: bool() }),
        support: obj({ phone: str(), shopAddress: str() }),
        policyVersion: str(),
        minSupportedAppVersion: str("Prompt users below this version to update"),
        features: obj({}),
      }),
    },
  },
  "/api/v1/home": {
    get: {
      tags: tagApp,
      summary: "Home feed",
      description: "Device categories, popular devices, featured protection products and designs, and the latest articles in the requested language.",
      security: "public",
      response: obj({ categories: arr(obj({})), popularDevices: arr(obj({})), featuredProducts: arr(obj({})), featuredDesigns: arr(obj({})), latestArticles: arr(obj({})) }),
    },
  },
  "/api/v1/health": {
    get: { tags: tagApp, summary: "Service health", security: "public", response: obj({ status: str(undefined, { enum: ["ok", "degraded"] }), db: str() }) },
  },
};
