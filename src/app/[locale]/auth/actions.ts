"use server";
import { db } from "@/server/db";
import { runAction } from "@/server/actions";
import { AppError } from "@/server/errors";
import { getSetting } from "@/server/settings";

/** Record acceptance of terms + privacy at registration (FR-AUTH-09). */
export async function recordConsent() {
  return runAction(async (actor) => {
    if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
    const policyVersion = await getSetting("policy.version");
    await db.consentRecord.createMany({
      data: [
        { userId: actor.userId, type: "terms", policyVersion },
        { userId: actor.userId, type: "privacy", policyVersion },
      ],
    });
  }, { refresh: false });
}
