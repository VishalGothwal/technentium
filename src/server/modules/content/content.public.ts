import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { ContentType } from "@/generated/prisma/client";
import type { Locale } from "@/i18n/config";
import type { ListContentQuery } from "@/lib/schemas/content";
import * as q from "./content.queries";

/**
 * Cached public reads. Tagged so CMS changes invalidate them (see `invalidateContent`);
 * the "minutes" lifetime also lets scheduled items appear within about a minute of their time.
 */
export const CONTENT_TAG = "content";
export const SPECS_TAG = "specs";

export async function getContentList(locale: Locale, query: ListContentQuery) {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("minutes");
  return q.queryContentList(locale, query);
}

export async function getFeatured(locale: Locale, type: ContentType = "ARTICLE") {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("minutes");
  return q.queryFeatured(locale, type);
}

export async function getTopicCounts(type: ContentType) {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("minutes");
  return q.queryTopicCounts(type);
}

export async function getContentDetail(type: ContentType, slug: string, locale: Locale) {
  "use cache";
  cacheTag(CONTENT_TAG, SPECS_TAG, `content:${type}:${slug}`);
  cacheLife("minutes");
  return q.queryContentDetail(type, slug, locale);
}

export async function getRelatedGuides(locale: Locale, opts: { topic?: string | null; tags?: string[]; limit?: number }) {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("minutes");
  return q.queryRelatedCards({ locale, type: "ARTICLE", topic: opts.topic, tags: opts.tags, limit: opts.limit ?? 3 });
}

export async function getSpecList(opts: { q?: string | null; brand?: string | null }) {
  "use cache";
  cacheTag(SPECS_TAG);
  cacheLife("minutes");
  return q.querySpecList(opts);
}

export async function getSpecBrands() {
  "use cache";
  cacheTag(SPECS_TAG);
  cacheLife("minutes");
  return q.querySpecBrands();
}

export async function getSpecDetail(slug: string) {
  "use cache";
  cacheTag(SPECS_TAG, `spec:${slug}`);
  cacheLife("minutes");
  return q.querySpecDetail(slug);
}

export async function getArticlesForSpec(specId: string, locale: Locale) {
  "use cache";
  cacheTag(CONTENT_TAG, SPECS_TAG);
  cacheLife("minutes");
  return q.queryArticlesForSpec(specId, locale);
}

export async function getCompare(ids: string[]) {
  "use cache";
  cacheTag(SPECS_TAG);
  cacheLife("minutes");
  return q.queryCompare(ids);
}

export async function getCompareOptions() {
  "use cache";
  cacheTag(SPECS_TAG);
  cacheLife("minutes");
  return q.queryCompareOptions();
}

export async function getComparisonDetail(slug: string) {
  "use cache";
  cacheTag(SPECS_TAG, `comparison:${slug}`);
  cacheLife("minutes");
  return q.queryComparisonDetail(slug);
}

export async function getComparisonList() {
  "use cache";
  cacheTag(SPECS_TAG);
  cacheLife("minutes");
  return q.queryComparisonList();
}
