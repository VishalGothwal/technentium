"use server";
import { db } from "@/server/db";
import { runAction } from "@/server/actions";
import { AppError } from "@/server/errors";
import { getSetting } from "@/server/settings";
import * as flows from "@/server/auth/flows";

/** Record acceptance of terms + privacy at registration (FR-AUTH-09). */
export async function recordConsent() {
  return runAction(
    async (actor) => {
      if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
      const policyVersion = await getSetting("policy.version");
      await db.consentRecord.createMany({
        data: [
          { userId: actor.userId, type: "terms", policyVersion },
          { userId: actor.userId, type: "privacy", policyVersion },
        ],
      });
    },
    { refresh: false },
  );
}

// Sign-in flows (Supabase Auth). Each delegates to `server/auth/flows`, which enforces the feature switches.
export const signInWithPasswordAction = async (email: string, password: string) => flows.signInWithPassword({ email, password });
export const signUpWithPasswordAction = async (input: { name: string; email: string; password: string; locale: string; next: string }) =>
  flows.signUpWithPassword(input);
export const sendPhoneOtpAction = async (phone: string) => flows.sendPhoneOtp(phone);
export const verifyPhoneOtpAction = async (phone: string, code: string) => flows.verifyPhoneOtp(phone, code);
export const startGoogleSignInAction = async (next: string) => flows.startGoogleSignIn(next);
export const requestPasswordResetAction = async (email: string, locale: string) => flows.requestPasswordReset(email, locale);
export const setNewPasswordAction = async (password: string) => flows.setNewPassword(password);
export const signOutAction = async () => flows.signOut();
