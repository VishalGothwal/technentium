import type { PathsObject, SchemaObject } from "./types";

/** OpenAPI paths for articles, videos, specifications and comparisons (PRD §11.6). */

const locale = { name: "locale", in: "query" as const, schema: { type: "string", enum: ["en", "hi"] }, description: "Content language; falls back to English when a translation isn't published. Defaults to Accept-Language." };
const slug = { name: "slug", in: "path" as const, required: true, schema: { type: "string" } };
const listParams = [
  { name: "topic", in: "query" as const, schema: { type: "string", enum: ["repair-guides", "buying-guides", "protection", "tips", "news"] } },
  { name: "tag", in: "query" as const, schema: { type: "string" } },
  { name: "q", in: "query" as const, schema: { type: "string", maxLength: 100 }, description: "Search title and summary" },
  { name: "page", in: "query" as const, schema: { type: "integer", minimum: 1, default: 1 } },
  { name: "pageSize", in: "query" as const, schema: { type: "integer", minimum: 1, maximum: 48, default: 12 } },
  locale,
];

const card: SchemaObject = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: ["ARTICLE", "VIDEO"] },
    slug: { type: "string" },
    topic: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    coverMediaId: { type: ["string", "null"], description: "Image via GET /api/v1/media/{id}" },
    videoUrl: { type: ["string", "null"] },
    title: { type: "string" },
    summary: { type: "string" },
    readingMinutes: { type: "integer" },
    publishedAt: { type: "string", format: "date-time" },
    shownLocale: { type: "string", enum: ["en", "hi"] },
    isFallback: { type: "boolean", description: "true when the requested language isn't published and English is shown" },
  },
};
const page = (item: SchemaObject): SchemaObject => ({
  type: "object",
  properties: { items: { type: "array", items: item }, total: { type: "integer" }, page: { type: "integer" }, pageSize: { type: "integer" } },
});
const block: SchemaObject = {
  type: "object",
  description:
    "Content block. `type` is one of heading (level 2|3, text), paragraph (text), list (style bullet|number, items), quote (text, cite?), image (mediaId, alt, caption?), video (url, title?), callout (tone tip|warning|info, title?, text), cta (kind repair|protection|customize|specs), related (items[{targetType,targetId}]). Text uses safe inline markup: **bold**, *italic*, [label](https://… or /path). HTML is never allowed.",
  properties: { type: { type: "string" } },
  additionalProperties: true,
};
const link: SchemaObject = {
  type: "object",
  properties: { targetType: { type: "string" }, targetId: { type: "string" }, title: { type: "string" }, href: { type: "string" }, summary: { type: ["string", "null"] } },
};
const detail: SchemaObject = {
  allOf: [
    card,
    {
      type: "object",
      properties: {
        body: { type: "array", items: block },
        seoTitle: { type: ["string", "null"] },
        metaDescription: { type: ["string", "null"] },
        availableLocales: { type: "array", items: { type: "string" } },
        explicitRelated: { type: "array", items: link },
        blockLinks: { type: "array", items: link },
        autoRelated: { type: "array", items: card },
      },
    },
  ],
};
const specGroup: SchemaObject = {
  type: "object",
  properties: {
    group: { type: "string" },
    labelEn: { type: "string" },
    labelHi: { type: ["string", "null"] },
    items: {
      type: "array",
      items: { type: "object", properties: { key: { type: "string" }, labelEn: { type: "string" }, labelHi: { type: ["string", "null"] }, value: { type: ["string", "null"], description: "null = data not available (not the same as \"No\")" } } },
    },
  },
};
const spec: SchemaObject = {
  type: "object",
  properties: {
    id: { type: "string" },
    slug: { type: "string" },
    summaryEn: { type: ["string", "null"] },
    summaryHi: { type: ["string", "null"] },
    releaseDate: { type: ["string", "null"], format: "date-time" },
    launchPricePaise: { type: ["integer", "null"] },
    specs: { type: "array", items: specGroup },
    deviceModel: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, brand: { type: "object", properties: { name: { type: "string" }, slug: { type: "string" } } } } },
  },
};
const compareRows: SchemaObject = {
  type: "array",
  items: {
    type: "object",
    properties: {
      group: { type: "string" },
      labelEn: { type: "string" },
      rows: { type: "array", items: { type: "object", properties: { key: { type: "string" }, labelEn: { type: "string" }, values: { type: "array", items: { type: ["string", "null"] } }, differs: { type: "boolean" } } } },
    },
  },
};
const translationInput: SchemaObject = {
  type: "object",
  required: ["title", "summary", "body"],
  properties: { title: { type: "string", maxLength: 160 }, summary: { type: "string", maxLength: 400 }, body: { type: "array", items: block }, seoTitle: { type: "string", maxLength: 70 }, metaDescription: { type: "string", maxLength: 170 } },
};

export const paths: PathsObject = {
  "/api/v1/content/articles": { get: { tags: ["Content"], summary: "List published articles", security: "public", parameters: listParams, response: page(card) } },
  "/api/v1/content/articles/{slug}": { get: { tags: ["Content"], summary: "Get a published article", security: "public", parameters: [slug, locale], response: detail } },
  "/api/v1/content/videos": { get: { tags: ["Content"], summary: "List published videos", security: "public", parameters: listParams, response: page(card) } },
  "/api/v1/content/videos/{slug}": { get: { tags: ["Content"], summary: "Get a published video", security: "public", parameters: [slug, locale], response: detail } },
  "/api/v1/content/specs": {
    get: {
      tags: ["Specifications"],
      summary: "List devices with published specifications",
      security: "public",
      parameters: [
        { name: "q", in: "query", schema: { type: "string" } },
        { name: "brand", in: "query", schema: { type: "string" }, description: "Brand slug" },
      ],
      response: { type: "object", properties: { items: { type: "array", items: spec }, brands: { type: "array", items: { type: "object", properties: { slug: { type: "string" }, name: { type: "string" } } } } } },
    },
  },
  "/api/v1/content/devices/{slug}": { get: { tags: ["Specifications"], summary: "Get a device specification sheet", security: "public", parameters: [slug], response: spec } },
  "/api/v1/content/comparisons": { get: { tags: ["Specifications"], summary: "List curated comparisons", security: "public" } },
  "/api/v1/content/comparisons/{slug}": {
    get: { tags: ["Specifications"], summary: "Get a curated comparison", security: "public", parameters: [slug], response: { type: "object", properties: { slug: { type: "string" }, titleEn: { type: "string" }, devices: { type: "array", items: spec }, rows: compareRows } } },
  },
  "/api/v1/content/compare": {
    get: {
      tags: ["Specifications"],
      summary: "Compare 2–3 devices",
      security: "public",
      parameters: [{ name: "ids", in: "query", required: true, schema: { type: "string" }, description: "Comma-separated spec slugs, spec ids or device model ids (2–3)" }],
      response: { type: "object", properties: { devices: { type: "array", items: spec }, rows: compareRows } },
    },
  },
  "/api/v1/admin/content/articles": {
    get: {
      tags: ["Content admin"],
      summary: "List content for the CMS (content.edit)",
      security: "staff",
      parameters: [
        { name: "type", in: "query", schema: { type: "string", enum: ["ARTICLE", "VIDEO"] } },
        { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] } },
        { name: "locale", in: "query", schema: { type: "string", enum: ["en", "hi"] } },
        { name: "topic", in: "query", schema: { type: "string" } },
        { name: "q", in: "query", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer" } },
      ],
    },
    post: {
      tags: ["Content admin"],
      summary: "Create an article or video (draft) — content.edit",
      security: "staff",
      requestBody: {
        schema: {
          type: "object",
          required: ["slug", "topic", "translation"],
          properties: {
            type: { type: "string", enum: ["ARTICLE", "VIDEO"], default: "ARTICLE" },
            slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
            topic: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            coverMediaId: { type: "string" },
            videoUrl: { type: "string", description: "Required for VIDEO (YouTube or Vimeo)" },
            featured: { type: "boolean" },
            locale: { type: "string", enum: ["en", "hi"], default: "en" },
            translation: translationInput,
          },
        },
      },
      response: { type: "object", properties: { id: { type: "string" }, slug: { type: "string" }, type: { type: "string" } } },
    },
  },
  "/api/v1/admin/content/articles/{id}": {
    get: { tags: ["Content admin"], summary: "Get content for editing", security: "staff", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] },
    patch: {
      tags: ["Content admin"],
      summary: "Update item, translations and relations — content.edit",
      security: "staff",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        schema: {
          type: "object",
          properties: {
            item: { type: "object", description: "Any of slug, topic, tags, coverMediaId, videoUrl, featured" },
            translations: { type: "object", properties: { en: translationInput, hi: translationInput } },
            relations: { type: "array", items: { type: "object", properties: { targetType: { type: "string" }, targetId: { type: "string" } } } },
            expectedUpdatedAt: { type: "string", format: "date-time", description: "Optimistic concurrency check" },
          },
        },
      },
    },
  },
  "/api/v1/admin/content/articles/{id}/publish": {
    post: {
      tags: ["Content admin"],
      summary: "Publish, schedule, unpublish or archive one language — content.publish",
      security: "staff",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        schema: {
          type: "object",
          required: ["locale", "action"],
          properties: { locale: { type: "string", enum: ["en", "hi"] }, action: { type: "string", enum: ["publish", "schedule", "unpublish", "archive"] }, scheduledAt: { type: "string", format: "date-time" } },
        },
      },
    },
  },
};
