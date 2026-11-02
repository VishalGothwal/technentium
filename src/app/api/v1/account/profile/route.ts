import { api, jsonBody } from "@/server/http";
import { requestEmailChange } from "@/server/auth/flows";
import { getAuthIdentity } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getProfile, updateProfile } from "@/server/modules/account/account.service";

/** GET /api/v1/account/profile — the signed-in user's profile. */
export const GET = api(async (_req, _ctx, actor) => getProfile(actor));

/**
 * PATCH /api/v1/account/profile — `{ name?, preferredLocale?, email? }`.
 * An email change sends a confirmation link to the new address; the email updates once confirmed.
 * Mobile apps change email with the Supabase SDK (`auth.updateUser({ email })`) instead.
 */
export const PATCH = api(async (req, _ctx, actor) => {
  const result = await updateProfile(actor, await jsonBody(req));
  if (result.emailChangeRequested) {
    if ((await getAuthIdentity())?.viaBearer || actor?.impersonator) throw new AppError("CONFLICT", "errors.emailChangeInApp");
    const { preferredLocale } = await getProfile(actor);
    const res = await requestEmailChange(result.emailChangeRequested, `/${preferredLocale}/account`);
    if (!res.ok)
      throw new AppError(res.error === "auth.tooMany" ? "RATE_LIMITED" : "VALIDATION", res.error === "auth.emailTaken" ? "auth.emailTaken" : "errors.generic");
  }
  return {
    ...(await getProfile(actor)),
    emailChangePending: !!result.emailChangeRequested,
  };
});
