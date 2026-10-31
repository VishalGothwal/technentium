import { api, jsonBody } from "@/server/http";
import { auth } from "@/server/auth/auth";
import { getProfile, updateProfile } from "@/server/modules/account/account.service";

/** GET /api/v1/account/profile — the signed-in user's profile. */
export const GET = api(async (_req, _ctx, actor) => getProfile(actor));

/**
 * PATCH /api/v1/account/profile — `{ name?, preferredLocale?, email? }`.
 * An email change sends a verification link to the new address; the email updates once confirmed.
 */
export const PATCH = api(async (req, _ctx, actor) => {
  const result = await updateProfile(actor, await jsonBody(req));
  if (result.emailChangeRequested) {
    await auth.api.changeEmail({ body: { newEmail: result.emailChangeRequested, callbackURL: "/en/account" }, headers: req.headers });
  }
  return { ...(await getProfile(actor)), emailChangePending: !!result.emailChangeRequested };
});
