"use server";
import { runAction } from "@/server/actions";
import {
  addCustomizationNote,
  setCustomizationNextSteps,
  shareCustomizationQuote,
  transitionCustomization,
} from "@/server/modules/customization/customization.service";

export async function transitionCustomizationAction(id: string, to: string, reason: string) {
  return runAction((actor) => transitionCustomization(actor, id, { to, reason }));
}

export async function shareCustomizationQuoteAction(id: string, quotedPaise: number, message: string) {
  return runAction((actor) => shareCustomizationQuote(actor, id, { quotedPaise, message }));
}

export async function setCustomizationNextStepsAction(id: string, nextSteps: string) {
  return runAction((actor) => setCustomizationNextSteps(actor, id, { nextSteps }));
}

export async function addCustomizationNoteAction(id: string, body: string, visibility: "INTERNAL" | "CUSTOMER") {
  return runAction((actor) => addCustomizationNote(actor, id, { body, visibility }));
}
