/**
 * Content validation shared by the CMS editor (client), the admin API and the services.
 * Error messages are translation keys (content.*.json).
 */
import { z } from "zod";
import { containsHtml, safeHref } from "@/lib/content/inline";
import { parseVideoUrl } from "@/lib/content/video";

export const CONTENT_TOPICS = ["repair-guides", "buying-guides", "protection", "tips", "news"] as const;
export type ContentTopic = (typeof CONTENT_TOPICS)[number];
export const isContentTopic = (s: string): s is ContentTopic => (CONTENT_TOPICS as readonly string[]).includes(s);

export const CONTENT_LOCALES = ["en", "hi"] as const;
export const RELATION_TARGETS = ["CONTENT", "PRODUCT", "PRODUCT_CATEGORY", "REPAIR_CATEGORY", "DEVICE_SPEC", "COMPARISON"] as const;
export type RelationTarget = (typeof RELATION_TARGETS)[number];
export const CTA_KINDS = ["repair", "protection", "customize", "specs"] as const;

/** Slugs reserved by static routes under /articles and /videos. */
const RESERVED_SLUGS = new Set(["topic", "new", "preview", "search", "page"]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "articles.validation.slug")
  .max(120, "articles.validation.slug")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "articles.validation.slug")
  .refine((s) => !RESERVED_SLUGS.has(s), "articles.validation.slugReserved");

/** Plain text with optional inline markup; HTML is rejected outright. */
const text = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min, "validation.required")
    .max(max, "articles.validation.tooLong")
    .refine((s) => !containsHtml(s), "articles.validation.noHtml");

const optionalText = (max: number) => text(max, 0).optional();

const headingBlock = z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: text(160) });
const paragraphBlock = z.object({ type: z.literal("paragraph"), text: text(5000) });
const listBlock = z.object({ type: z.literal("list"), style: z.enum(["bullet", "number"]), items: z.array(text(1000)).min(1, "validation.required").max(40) });
const quoteBlock = z.object({ type: z.literal("quote"), text: text(1000), cite: optionalText(160) });
const imageBlock = z.object({ type: z.literal("image"), mediaId: z.string().min(1, "validation.required").max(40), alt: text(200), caption: optionalText(300) });
const videoBlock = z.object({
  type: z.literal("video"),
  url: z.string().trim().refine((u) => parseVideoUrl(u) !== null, "articles.validation.videoUrl"),
  title: optionalText(160),
});
const calloutBlock = z.object({ type: z.literal("callout"), tone: z.enum(["tip", "warning", "info"]), title: optionalText(120), text: text(1500) });
const ctaBlock = z.object({ type: z.literal("cta"), kind: z.enum(CTA_KINDS), title: optionalText(120), text: optionalText(300) });
const relatedBlock = z.object({
  type: z.literal("related"),
  title: optionalText(120),
  items: z.array(z.object({ targetType: z.enum(RELATION_TARGETS), targetId: z.string().min(1).max(40) })).min(1, "validation.required").max(6),
});

export const blockSchema = z.discriminatedUnion("type", [headingBlock, paragraphBlock, listBlock, quoteBlock, imageBlock, videoBlock, calloutBlock, ctaBlock, relatedBlock]);
export type ContentBlock = z.infer<typeof blockSchema>;
export type BlockType = ContentBlock["type"];
export const BLOCK_TYPES: BlockType[] = ["heading", "paragraph", "list", "quote", "image", "video", "callout", "cta", "related"];

export const blocksSchema = z.array(blockSchema).max(300, "articles.validation.tooLong");

/** Inline links inside text must use allowed schemes. */
export function unsafeLinksIn(blocks: ContentBlock[]): string[] {
  const bad: string[] = [];
  const scan = (s: string | undefined) => {
    if (!s) return;
    for (const m of s.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) if (!safeHref(m[1]!)) bad.push(m[1]!);
  };
  for (const b of blocks) {
    if ("text" in b) scan(b.text);
    if (b.type === "list") b.items.forEach(scan);
  }
  return bad;
}

export const translationSchema = z.object({
  title: text(160),
  summary: text(400),
  body: blocksSchema.refine((b) => unsafeLinksIn(b).length === 0, "articles.validation.unsafeLink"),
  seoTitle: optionalText(70),
  metaDescription: optionalText(170),
});
export type TranslationInput = z.infer<typeof translationSchema>;

const tagSchema = z.string().trim().toLowerCase().min(2).max(30).regex(/^[a-z0-9-]+$/, "articles.validation.tag");

export const contentItemSchema = z.object({
  type: z.enum(["ARTICLE", "VIDEO"]).default("ARTICLE"),
  slug: slugSchema,
  topic: z.enum(CONTENT_TOPICS),
  tags: z.array(tagSchema).max(12).default([]),
  coverMediaId: z.string().max(40).nullish(),
  videoUrl: z
    .string()
    .trim()
    .nullish()
    .refine((u) => !u || parseVideoUrl(u) !== null, "articles.validation.videoUrl"),
  featured: z.boolean().default(false),
});

/** POST /admin/content/articles — the item plus the first translation. */
export const createContentSchema = contentItemSchema
  .extend({ locale: z.enum(CONTENT_LOCALES).default("en"), translation: translationSchema })
  .refine((v) => v.type !== "VIDEO" || !!v.videoUrl, { path: ["videoUrl"], message: "articles.validation.videoRequired" });
export type CreateContentInput = z.infer<typeof createContentSchema>;

/** PATCH /admin/content/articles/{id} — any subset of item fields and per-locale translations. */
export const updateContentSchema = z.object({
  item: contentItemSchema.omit({ type: true }).partial().optional(),
  translations: z.partialRecord(z.enum(CONTENT_LOCALES), translationSchema).optional(),
  relations: z.array(z.object({ targetType: z.enum(RELATION_TARGETS), targetId: z.string().min(1).max(40) })).max(20).optional(),
  /** Optimistic concurrency: the updatedAt the editor loaded. */
  expectedUpdatedAt: z.iso.datetime().optional(),
});
export type UpdateContentInput = z.infer<typeof updateContentSchema>;

export const publishSchema = z
  .object({
    locale: z.enum(CONTENT_LOCALES),
    action: z.enum(["publish", "schedule", "unpublish", "archive"]),
    scheduledAt: z.iso.datetime().optional(),
  })
  .refine((v) => v.action !== "schedule" || (!!v.scheduledAt && new Date(v.scheduledAt).getTime() > Date.now()), {
    path: ["scheduledAt"],
    message: "articles.validation.scheduleFuture",
  });
export type PublishInput = z.infer<typeof publishSchema>;

export const listContentQuerySchema = z.object({
  type: z.enum(["ARTICLE", "VIDEO"]).default("ARTICLE"),
  topic: z.enum(CONTENT_TOPICS).optional(),
  tag: tagSchema.optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});
export type ListContentQuery = z.infer<typeof listContentQuerySchema>;

// ───────────── Specifications (FR-SPEC) ─────────────

/** `value: null` means "data not available" — distinct from "No", "0" or an empty feature (FR-SPEC-04). */
export const specItemSchema = z.object({
  key: z.string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/, "articles.validation.key"),
  labelEn: text(80),
  labelHi: optionalText(80),
  value: z.string().trim().max(300).refine((s) => !containsHtml(s), "articles.validation.noHtml").nullable(),
});
export const specGroupSchema = z.object({
  group: z.string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/, "articles.validation.key"),
  labelEn: text(60),
  labelHi: optionalText(60),
  items: z.array(specItemSchema).max(40),
});
export const specGroupsSchema = z.array(specGroupSchema).max(20);
export type SpecGroup = z.infer<typeof specGroupSchema>;
export type SpecItem = z.infer<typeof specItemSchema>;

export const specInputSchema = z.object({
  deviceModelId: z.string().min(1, "validation.required"),
  slug: slugSchema,
  releaseDate: z.iso.date().nullish(),
  launchPricePaise: z.number().int().min(0).max(100_000_000).nullish(),
  summaryEn: optionalText(500),
  summaryHi: optionalText(500),
  specs: specGroupsSchema,
  imageMediaId: z.string().max(40).nullish(),
  seoTitle: optionalText(70),
  metaDescription: optionalText(170),
});
export type SpecInput = z.infer<typeof specInputSchema>;

export const comparisonInputSchema = z.object({
  slug: slugSchema,
  titleEn: text(160),
  titleHi: optionalText(160),
  introEn: optionalText(3000),
  introHi: optionalText(3000),
  verdictEn: optionalText(3000),
  verdictHi: optionalText(3000),
  specIds: z.array(z.string().min(1)).min(2, "compare.validation.devices").max(3, "compare.validation.devices"),
  seoTitle: optionalText(70),
  metaDescription: optionalText(170),
});
export type ComparisonInput = z.infer<typeof comparisonInputSchema>;

export const specStatusSchema = z.object({ action: z.enum(["publish", "unpublish", "archive"]) });
