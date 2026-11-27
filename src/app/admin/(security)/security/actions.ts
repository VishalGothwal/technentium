"use server";
import { refresh } from "next/cache";
import { getRealActor } from "@/server/auth/session";
import * as flows from "@/server/auth/flows";

/** Security changes act on the signed-in person's own Supabase account — never while switched into someone else's. */
async function ownAccount<T extends flows.AuthResult>(fn: () => Promise<T>): Promise<T | flows.AuthResult> {
  const real = await getRealActor();
  if (!real) return { ok: false, error: "auth.failed" };
  const res = await fn();
  if (res.ok) refresh();
  return res;
}

export const changePasswordAction = async (currentPassword: string, newPassword: string) =>
  ownAccount(() => flows.changePassword(currentPassword, newPassword));

export const startTotpEnrolmentAction = async () => ownAccount(() => flows.startTotpEnrolment());

/** Confirms a new factor (with `factorId`) or completes a sign-in that needs the code (/admin/two-factor). */
export const verifyTotpAction = async (code: string, factorId?: string) => ownAccount(() => flows.verifyTotp(code, factorId));
