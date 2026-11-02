"use server";
/**
 * Users & access Server Actions. Thin: each delegates to `user-admin.service`, which checks permissions.
 * While switched into another account these run as that account (and are refused); "view as" itself
 * always runs as the signed-in admin.
 */
import { runAction } from "@/server/actions";
import { getActor } from "@/server/auth/session";
import {
  resetTwoFactor,
  sendPasswordReset,
  setTemporaryPassword,
  setUserBlocked,
  signOutEverywhere,
  startViewAs,
  stopViewAs,
  updateUserProfile,
} from "@/server/modules/users/user-admin.service";

export const updateUserProfileAction = async (userId: string, input: unknown) => runAction((a) => updateUserProfile(a, userId, input));
export const setUserBlockedAction = async (userId: string, blocked: boolean, reason?: string) => runAction((a) => setUserBlocked(a, userId, blocked, reason));
export const sendPasswordResetAction = async (userId: string) => runAction((a) => sendPasswordReset(a, userId));
export const setTemporaryPasswordAction = async (userId: string, password: string) => runAction((a) => setTemporaryPassword(a, userId, password));
export const signOutEverywhereAction = async (userId: string) => runAction((a) => signOutEverywhere(a, userId));
export const resetTwoFactorAction = async (userId: string) => runAction((a) => resetTwoFactor(a, userId));

export const startViewAsAction = async (userId: string) => runAction((real) => startViewAs(real, userId), { real: true });
export const stopViewAsAction = async () => {
  const current = await getActor();
  return runAction((real) => stopViewAs(real, current?.impersonator ? current.userId : undefined), { real: true });
};
