"use server";
import { updateTag } from "next/cache";
import { runAction } from "@/server/actions";
import { DESIGNS_TAG } from "@/server/modules/customization/catalog.cached";
import { saveDesign, saveDesignOption, setDesignActive, setStudioSteps } from "@/server/modules/customization/design-admin.service";

/** Catalogue edits refresh the cached public design pages immediately (read-your-own-writes). */
async function withRefresh<T>(fn: () => Promise<T>) {
  const res = await fn();
  updateTag(DESIGNS_TAG);
  return res;
}

export async function saveDesignAction(id: string | null, input: unknown) {
  return runAction((actor) => withRefresh(() => saveDesign(actor, id, input)));
}

export async function setDesignActiveAction(id: string, active: boolean) {
  return runAction((actor) => withRefresh(() => setDesignActive(actor, id, active)));
}

export async function setStudioStepsAction(hiddenSteps: string[]) {
  return runAction((actor) => withRefresh(() => setStudioSteps(actor, { hiddenSteps })));
}

export async function saveDesignOptionAction(id: string | null, input: unknown) {
  return runAction((actor) => withRefresh(() => saveDesignOption(actor, id, input)));
}
