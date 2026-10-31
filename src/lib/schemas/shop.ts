/**
 * Validation shared by the protection store (client forms, API routes) and the shop services.
 * Error messages are translation keys.
 */
import { z } from "zod";
import { isValidIndianMobile, isValidPincode, normalizeIndianMobile } from "@/lib/phone";

/** States and union territories for pan-India shipping (FR-PROD-12). */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const MAX_LINE_QUANTITY = 10;
export const PRODUCT_SORTS = ["featured", "newest", "price_asc", "price_desc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/** Static segments under /protection that product slugs must not shadow. */
export const RESERVED_PRODUCT_SLUGS = ["cart", "checkout", "products", "orders", "search"];

const phone = z
  .string()
  .trim()
  .transform((v) => normalizeIndianMobile(v) ?? v)
  .refine(isValidIndianMobile, "validation.phone");

export const cartItemSchema = z.object({
  productId: z.string().min(1, "validation.required"),
  deviceModelId: z.string().min(1).nullish(),
  quantity: z.coerce.number().int().min(1, "shopErrors.quantity").max(MAX_LINE_QUANTITY, "shopErrors.quantity").default(1),
});
export type CartItemInput = z.infer<typeof cartItemSchema>;

export const cartQuantitySchema = z.object({
  quantity: z.coerce.number().int().min(1, "shopErrors.quantity").max(MAX_LINE_QUANTITY, "shopErrors.quantity"),
});

export const productRequestSchema = z.object({
  contactName: z.string().trim().min(2, "validation.name").max(80),
  contactPhone: phone,
  addressLine1: z.string().trim().min(5, "validation.address").max(200),
  addressLine2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(2, "shopErrors.city").max(80),
  state: z.enum(INDIAN_STATES, { error: "shopErrors.state" }),
  pincode: z.string().trim().refine(isValidPincode, "validation.pincode"),
  notes: z.string().trim().max(1000).optional().default(""),
});
export type ProductRequestInput = z.infer<typeof productRequestSchema>;

export const productListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  /** ProductType slug, e.g. hd-plus, privacy, anti-yellow. */
  type: z.string().trim().max(80).optional(),
  deviceModelId: z.string().trim().max(40).optional(),
  sort: z.enum(PRODUCT_SORTS).optional().default("featured"),
  inStock: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(48).optional().default(12),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

// ───────────── Staff ─────────────

const paise = z.coerce.number().int().min(0).max(100_000_000);

export const confirmRequestSchema = z.object({
  shippingPaise: paise,
  /** Lines not listed are confirmed at the requested quantity. */
  items: z.array(z.object({ id: z.string().min(1), confirmedQuantity: z.coerce.number().int().min(0).max(MAX_LINE_QUANTITY) })).max(30).default([]),
  message: z.string().trim().max(500).optional().default(""),
});
export type ConfirmRequestInput = z.infer<typeof confirmRequestSchema>;

export const reasonSchema = z.object({ reason: z.string().trim().min(3, "validation.reason").max(500) });
export const shipSchema = z.object({ trackingInfo: z.string().trim().min(3, "shopErrors.tracking").max(300) });
export const requestNoteSchema = z.object({ body: z.string().trim().min(1, "validation.required").max(2000), customerVisible: z.boolean().default(false) });

export const stockAdjustSchema = z.object({
  delta: z.coerce.number().int().min(-10000).max(10000).refine((v) => v !== 0, "shopErrors.delta"),
  reason: z.enum(["RECEIVED", "ADJUSTMENT", "RETURNED", "DAMAGED"]),
  note: z.string().trim().max(300).optional().default(""),
});

const slug = z
  .string()
  .trim()
  .min(2, "validation.required")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "shopErrors.slug");

export const productSpecSchema = z.object({ labelEn: z.string().trim().min(1).max(60), labelHi: z.string().trim().max(60).optional().default(""), value: z.string().trim().min(1).max(120) });

export const productSchema = z.object({
  slug: slug.refine((s) => !RESERVED_PRODUCT_SLUGS.includes(s), "shopErrors.slugReserved"),
  sku: z.string().trim().min(2, "validation.required").max(40),
  nameEn: z.string().trim().min(2, "validation.required").max(120),
  nameHi: z.string().trim().max(120).optional().default(""),
  summaryEn: z.string().trim().max(300).optional().default(""),
  summaryHi: z.string().trim().max(300).optional().default(""),
  descriptionEn: z.string().trim().max(5000).optional().default(""),
  descriptionHi: z.string().trim().max(5000).optional().default(""),
  categoryId: z.string().min(1, "validation.required"),
  typeId: z.string().min(1).nullish(),
  pricePaise: paise.refine((v) => v > 0, "shopErrors.price"),
  mrpPaise: paise.nullish(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  featured: z.boolean().default(false),
  universal: z.boolean().default(false),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000).default(5),
  specs: z.array(productSpecSchema).max(30).default([]),
  imageIds: z.array(z.string().min(1)).max(10).default([]),
  compatibleModelIds: z.array(z.string().min(1)).max(2000).default([]),
  seoTitle: z.string().trim().max(70).optional().default(""),
  metaDescription: z.string().trim().max(170).optional().default(""),
});
export type ProductInput = z.infer<typeof productSchema>;

/** Comparison traits a product type can be scored on (1–5); glass uses the first four, cases the rest. */
export const TYPE_TRAITS = ["clarity", "privacy", "antiGlare", "toughness", "protection", "grip", "slim", "showsColour"] as const;

export const productTypeSchema = z.object({
  categoryId: z.string().min(1, "validation.required"),
  slug,
  nameEn: z.string().trim().min(2, "validation.required").max(80),
  nameHi: z.string().trim().max(80).optional().default(""),
  descriptionEn: z.string().trim().max(400).optional().default(""),
  descriptionHi: z.string().trim().max(400).optional().default(""),
  highlights: z.partialRecord(z.enum(TYPE_TRAITS), z.int().min(1).max(5)).default({}),
  imageMediaId: z.string().min(1).nullish(),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});

export const productCategorySchema = z.object({
  slug,
  nameEn: z.string().trim().min(2, "validation.required").max(80),
  nameHi: z.string().trim().max(80).optional().default(""),
  descriptionEn: z.string().trim().max(300).optional().default(""),
  descriptionHi: z.string().trim().max(300).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});
