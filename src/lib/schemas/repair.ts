/**
 * Validation shared by the booking wizard (client) and the services (server).
 * Error messages are translation keys.
 */
import { z } from "zod";
import { isValidIndianMobile, isValidPincode, normalizeIndianMobile } from "@/lib/phone";

export const HANDOVER_METHODS = ["PICKUP_DROP", "WALK_IN", "ONSITE", "DROP_OFF_DELIVERY"] as const;
export type HandoverMethodKey = (typeof HANDOVER_METHODS)[number];

/** Methods that need an address in Jaipur (and so a serviceability check). */
export const METHODS_NEEDING_ADDRESS: readonly HandoverMethodKey[] = ["PICKUP_DROP", "ONSITE", "DROP_OFF_DELIVERY"];

const phone = z
  .string()
  .trim()
  .transform((v) => normalizeIndianMobile(v) ?? v)
  .refine(isValidIndianMobile, "validation.phone");

export const addressSchema = z.object({
  addressLine1: z.string().trim().min(5, "validation.address").max(200),
  addressLine2: z.string().trim().max(200).optional().default(""),
  landmark: z.string().trim().max(120).optional().default(""),
  pincode: z.string().trim().refine(isValidPincode, "validation.pincode"),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const bookingSchema = z
  .object({
    modelId: z.string().min(1, "validation.required"),
    issueTypeIds: z.array(z.string().min(1)).min(1, "validation.issues").max(8),
    description: z.string().trim().max(2000).optional().default(""),
    attachmentIds: z.array(z.string()).max(6, "validation.maxPhotos").default([]),
    handoverMethod: z.enum(HANDOVER_METHODS),
    address: addressSchema.optional(),
    slotId: z.string().min(1, "validation.slot"),
    contactName: z.string().trim().min(2, "validation.name").max(80),
    contactPhone: phone,
    handoverNotes: z.string().trim().max(500).optional().default(""),
    acceptPolicy: z.literal(true, { error: "validation.acceptPolicy" }),
  })
  .superRefine((v, ctx) => {
    if (METHODS_NEEDING_ADDRESS.includes(v.handoverMethod) && !v.address) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "validation.address" });
    }
  });
export type BookingInput = z.input<typeof bookingSchema>;
export type BookingParsed = z.output<typeof bookingSchema>;

export const reasonSchema = z.string().trim().min(3, "validation.reason").max(1000);

export const LINE_ITEM_KINDS = ["LABOUR", "PART", "DIAGNOSIS_FEE", "DISCOUNT", "OTHER"] as const;

export const quoteLineSchema = z.object({
  kind: z.enum(LINE_ITEM_KINDS),
  description: z.string().trim().min(2, "validation.required").max(200),
  quantity: z.int().min(1).max(100),
  unitPaise: z.int().min(0).max(100_000_00),
  taxable: z.boolean().default(true),
  priceItemId: z.string().nullish(),
  partGrade: z.string().trim().max(40).nullish(),
  compatibilityNote: z.string().trim().max(200).nullish(),
});
export type QuoteLineInput = z.input<typeof quoteLineSchema>;

export const quoteDraftSchema = z.object({
  lines: z.array(quoteLineSchema).max(50),
  customerMessage: z.string().trim().max(1000).optional().default(""),
});

export const RETURN_METHODS = ["COLLECTION", "DELIVERY"] as const;

export const quoteDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVED") }),
  z.object({
    decision: z.literal("DECLINED"),
    reason: z.string().trim().max(500).optional().default(""),
    returnMethod: z.enum(RETURN_METHODS),
    address: addressSchema.optional(),
    acceptCharges: z.literal(true, { error: "validation.acceptCharges" }),
  }),
]).superRefine((v, ctx) => {
  if (v.decision === "DECLINED" && v.returnMethod === "DELIVERY" && !v.address) {
    ctx.addIssue({ code: "custom", path: ["address"], message: "validation.address" });
  }
});
export type QuoteDecisionInput = z.input<typeof quoteDecisionSchema>;

export const inspectionSchema = z.object({
  receiptCondition: z.string().trim().min(3, "validation.required").max(2000),
  accessories: z.string().trim().max(500).optional().default(""),
  checklist: z.record(z.string(), z.boolean()).optional().default({}),
});

export const diagnosisSchema = z.object({
  findings: z.string().trim().min(3, "validation.required").max(4000),
  suspectedCause: z.string().trim().max(1000).optional().default(""),
  recommendedRepair: z.string().trim().max(2000).optional().default(""),
  partsRequired: z.string().trim().max(1000).optional().default(""),
});

export const qualityCheckSchema = z.object({
  passed: z.boolean(),
  notes: z.string().trim().max(2000).optional().default(""),
  checklist: z.record(z.string(), z.boolean()).optional().default({}),
});

export const noteSchema = z.object({
  body: z.string().trim().min(1, "validation.required").max(4000),
  visibility: z.enum(["INTERNAL", "CUSTOMER"]).default("INTERNAL"),
});
