"use server";
import { refresh } from "next/cache";
import { runAction } from "@/server/actions";
import { requestEmailChange, type AuthResult } from "@/server/auth/flows";
import { getActor } from "@/server/auth/session";
import { updateOwnStaffProfile } from "@/server/modules/team/team.service";

export const updateOwnProfileAction = async (input: unknown) => runAction((a) => updateOwnStaffProfile(a, input));

/** Supabase emails a confirmation link to the new address; the change applies once it is opened. */
export async function requestOwnEmailChangeAction(email: string): Promise<AuthResult> {
  const actor = await getActor();
  if (!actor?.isStaff || actor.impersonator) return { ok: false, error: "auth.failed" };
  const res = await requestEmailChange(email, "/admin/profile");
  if (res.ok) refresh();
  return res;
}
