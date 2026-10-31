"use server";
import { runAction } from "@/server/actions";
import { cancelMyCustomization, decideCustomizationQuote, replyToCustomizationInfo } from "@/server/modules/customization/customization.service";

export async function replyToCustomizationAction(reference: string, message: string) {
  return runAction((actor) => replyToCustomizationInfo(actor, reference, { message }));
}

export async function decideCustomizationAction(reference: string, decision: "ACCEPT" | "DECLINE", reason?: string) {
  return runAction((actor) => decideCustomizationQuote(actor, reference, { decision, reason }));
}

export async function cancelCustomizationAction(reference: string, reason?: string) {
  return runAction((actor) => cancelMyCustomization(actor, reference, { reason }));
}
