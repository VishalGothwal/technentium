"use server";
import * as flows from "@/server/auth/flows";

/** Staff sign-in is always email + password (customer sign-in switches don't apply), then TOTP when enabled. */
export const staffSignInAction = async (email: string, password: string) => flows.signInWithPassword({ email, password }, { staff: true });
export const verifyTotpAction = async (code: string) => flows.verifyTotp(code);
