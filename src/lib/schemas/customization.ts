import { z } from "zod";
import { COLLECTIONS, designStyleSchema, hexColor, TEXT_FONTS, TEXT_POSITIONS } from "@/lib/customization/style";

const id = z.string().min(1, "validation.required").max(64);

export const customizationTextSchema = z.object({
  value: z.string().trim().min(1, "validation.required").max(24, "studio.validation.textTooLong"),
  font: z.enum(TEXT_FONTS),
  position: z.enum(TEXT_POSITIONS),
  color: hexColor,
});

export const customizationArtworkSchema = z.object({
  mediaId: id,
  /** Relative to the printable area width. */
  scale: z.number().min(0.2).max(2),
  /** Offset from centre, -1 … 1 of half the area. */
  x: z.number().min(-1).max(1),
  y: z.number().min(-1).max(1),
});

/** FR-CUSTOM-01…07: what the customer submits from the studio. The server rebuilds names and prices. */
export const customizationRequestSchema = z.object({
  deviceModelId: id,
  designId: id.nullable().optional(),
  finishOptionId: id,
  coverageOptionId: id,
  palette: z.array(hexColor).min(2).max(5).optional(),
  text: customizationTextSchema.nullable().optional(),
  artwork: customizationArtworkSchema.nullable().optional(),
  notes: z.string().trim().max(1000).optional().default(""),
  acceptTerms: z.literal(true, { error: "studio.validation.acceptTerms" }),
});
export type CustomizationRequestInput = z.input<typeof customizationRequestSchema>;

export const customizationReplySchema = z.object({ message: z.string().trim().min(2, "validation.required").max(1000) });
export const customizationDecisionSchema = z.object({ decision: z.enum(["ACCEPT", "DECLINE"]), reason: z.string().trim().max(500).optional() });
export const customizationCancelSchema = z.object({ reason: z.string().trim().max(500).optional() });

// ───────────── Staff ─────────────

export const customizationTransitionSchema = z.object({
  to: z.enum(["UNDER_REVIEW", "NEEDS_INFO", "FEASIBILITY_CONFIRMED", "COMPLETED", "DECLINED", "CANCELLED"]),
  reason: z.string().trim().max(1000).optional().default(""),
});
export const customizationQuoteSchema = z.object({
  quotedPaise: z.number().int().min(0).max(10_000_000),
  message: z.string().trim().max(1000).optional().default(""),
});
export const customizationNoteSchema = z.object({
  body: z.string().trim().min(1, "validation.required").max(2000),
  visibility: z.enum(["INTERNAL", "CUSTOMER"]),
});
export const customizationNextStepsSchema = z.object({ nextSteps: z.string().trim().max(1000) });

const slug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "studio.validation.slug").max(80);

export const designInputSchema = z.object({
  slug,
  nameEn: z.string().trim().min(2).max(80),
  nameHi: z.string().trim().max(80).optional().default(""),
  descriptionEn: z.string().trim().max(500).optional().default(""),
  descriptionHi: z.string().trim().max(500).optional().default(""),
  collection: z.enum(COLLECTIONS),
  style: designStyleSchema,
  basePricePaise: z.number().int().min(0).max(10_000_000).nullable(),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});
export type DesignInput = z.input<typeof designInputSchema>;

export const designOptionInputSchema = z.object({
  kind: z.enum(["FINISH", "COVERAGE"]),
  slug,
  nameEn: z.string().trim().min(2).max(60),
  nameHi: z.string().trim().max(60).optional().default(""),
  descriptionEn: z.string().trim().max(300).optional().default(""),
  descriptionHi: z.string().trim().max(300).optional().default(""),
  priceDeltaPaise: z.number().int().min(0).max(1_000_000),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});
export type DesignOptionInput = z.input<typeof designOptionInputSchema>;
