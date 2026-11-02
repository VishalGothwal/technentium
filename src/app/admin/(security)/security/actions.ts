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

export const startTotpAction = async (password: string) => ownAccount(() => flows.startTotpEnrollment(password));
export const confirmTotpAction = async (factorId: string, code: string) => ownAccount(() => flows.confirmTotpEnrollment(factorId, code));
export const disableTotpAction = async (password: string) => {
  // Owners must keep two-factor on (PRD §7.6).
  if ((await getRealActor())?.roles.includes("owner")) return { ok: false as const, error: "errors.generic" as const };
  return ownAccount(() => flows.disableTotp(password));
};
export const changePasswordAction = async (currentPassword: string, newPassword: string) =>
  ownAccount(() => flows.changePassword(currentPassword, newPassword));
