import { z } from "zod";

/** Studio steps in order. Device and review are always shown; the others can be switched off. */
export const STUDIO_STEPS = ["device", "design", "colour", "finish", "artwork", "review"] as const;
export type StudioStep = (typeof STUDIO_STEPS)[number];

/** Steps the owner can hide for the whole studio (Admin → Design catalogue → Studio sections). */
export const OPTIONAL_STEPS = ["design", "colour", "finish", "artwork"] as const;
export type OptionalStep = (typeof OPTIONAL_STEPS)[number];

/** Steps a single design can hide (choosing the design itself can't be hidden by that design). */
export const DESIGN_HIDEABLE_STEPS = ["colour", "finish", "artwork"] as const;
export type DesignHideableStep = (typeof DESIGN_HIDEABLE_STEPS)[number];

export const hiddenStepsSchema = z.array(z.enum(OPTIONAL_STEPS)).max(OPTIONAL_STEPS.length);
export const designHiddenStepsSchema = z.array(z.enum(DESIGN_HIDEABLE_STEPS)).max(DESIGN_HIDEABLE_STEPS.length);

export const STEP_LABELS: Record<OptionalStep, { label: string; description: string }> = {
  design: { label: "Design", description: "Pick a ready-made design. Off: customers start from a blank skin (links with ?design= still preselect one)." },
  colour: { label: "Colour & text", description: "Recolour the design and add a name or text. Off: the design's own colours, no text." },
  finish: { label: "Finish & coverage", description: "Choose matte/gloss/… and how much of the device is covered. Off: the first finish and coverage in the list are used." },
  artwork: { label: "Artwork", description: "Upload a photo or logo. Off: no uploads." },
};

/** Steps the customer sees: the global switches, then whatever the chosen design hides. */
export function visibleSteps(globalHidden: readonly string[], designHidden: readonly string[] = []): StudioStep[] {
  const hidden = new Set([...globalHidden, ...designHidden]);
  return STUDIO_STEPS.filter((s) => !hidden.has(s));
}

/** Read a stored list, keeping only known optional steps. */
export const readHiddenSteps = (v: unknown): OptionalStep[] => (Array.isArray(v) ? v.filter((x): x is OptionalStep => (OPTIONAL_STEPS as readonly string[]).includes(x)) : []);
