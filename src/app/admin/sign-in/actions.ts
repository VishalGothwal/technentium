"use server";
import * as flows from "@/server/auth/flows";

/** Staff sign-in is always email + password (customer sign-in switches don't apply), then TOTP when enabled. */
export const staffSignInAction = async (email: string, password: string) =>
  flows.signInWithPassword({ email: withTestDomain(email), password }, { staff: true });

/** Outside production a bare username ("admin") means the seeded test account <username>@technentium.test. */
function withTestDomain(login: string) {
  const value = login.trim();
  return process.env.NODE_ENV !== "production" && value && !value.includes("@") ? `${value}@technentium.test` : value;
}
export const verifyTotpAction = async (code: string) => flows.verifyTotp(code);
