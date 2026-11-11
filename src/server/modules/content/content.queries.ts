import "server-only";
import { MODEL3D_SELECT } from "@/lib/device-3d";
import { deviceName } from "@/lib/content/specs";
import type { ContentType, Prisma } from "@/generated/prisma/client";
import type { Locale } from "@/i18n/config";
import { db } from "@/server/db";
import { blocksSchema, specGroupSchema, specGroupsSchema, type ContentBlock, type ListContentQuery, type RelationTarget, type SpecGroup } from "@/lib/schemas/content";

/**
 * Uncached public content queries. `content.public.ts` wraps these with `'use cache'`;
 * tests and the admin preview call them directly.
 *
 * Visibility rule: a translation is public when PUBLISHED, or SCHEDULED with scheduledAt in the past
 * (scheduled publishing needs no cron — FR-CMS-05).
 */
export const visibleTranslation = (now: Date): Prisma.ContentTranslationWhereInput => ({
  OR: [{ status: "PUBLISHED" }, { status: "SCHEDULED", scheduledAt: { lte: now } }],
});
export const visibleStatus = (now: Date) => ({ OR: [{ status: "PUBLISHED" as const }, { status: "SCHEDULED" as const, publishedAt: { lte: now } }] });

export { contentPath } from "@/lib/content/paths";
import { contentPath } from "@/lib/content/paths";

/** Parse stored JSON defensively: invalid stored blocks are dropped rather than breaking the page. */
export function safeBlocks(raw: unknown): ContentBlock[] {
  if (!Array.isArray(raw)) return [];
  const parsed = blocksSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return raw.flatMap((b) => {
    const one = blocksSchema.safeParse([b]);
    return one.success ? one.data : [];
  });
}

export function safeSpecs(raw: unknown): SpecGroup[] {
  const parsed = specGroupsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // One malformed group must not hide the whole sheet: keep the groups that are valid.
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((g) => {
    const one = specGroupSchema.safeParse(g);
    return one.success ? [one.data] : [];
  }).slice(0, 20);
}

const CARD_ITEM_SELECT = {
  id: true,
  type: true,
  slug: true,
  topic: true,
  tags: true,
  coverMediaId: true,
  videoUrl: true,
  featured: true,
  author: { select: { name: true } },
} as const;

type VisibleTranslation = { contentItemId: string; locale: string; title: string; summary: string; readingMinutes: number; publishedAt: Date | null; scheduledAt: Date | null; updatedAt: Date };

export type ContentCard = {
  id: string;
  type: ContentType;
  slug: string;
  topic: string;
  tags: string[];
  coverMediaId: string | null;
  videoUrl: string | null;
  featured: boolean;
  authorName: string;
  title: string;
  summary: string;
  readingMinutes: number;
  publishedAt: Date;
  /** Locale actually shown (falls back to English when the requested translation is not published). */
  shownLocale: Locale;
  isFallback: boolean;
};

/** Choose the translation to show for `locale`, falling back to English (FR-CMS-04 / D-12). */
function pick<T extends { locale: string }>(translations: T[], locale: Locale): { t: T; isFallback: boolean } | null {
  const exact = translations.find((t) => t.locale === locale);
  if (exact) return { t: exact, isFallback: false };
  const en = translations.find((t) => t.locale === "en") ?? translations[0];
  return en ? { t: en, isFallback: true } : null;
}

const effectiveDate = (t: { publishedAt: Date | null; scheduledAt: Date | null; updatedAt: Date }) => t.publishedAt ?? t.scheduledAt ?? t.updatedAt;

async function visibleTranslations(where: Prisma.ContentTranslationWhereInput, now: Date): Promise<VisibleTranslation[]> {
  return db.contentTranslation.findMany({
    where: { AND: [visibleTranslation(now), where] },
    select: { contentItemId: true, locale: true, title: true, summary: true, readingMinutes: true, publishedAt: true, scheduledAt: true, updatedAt: true },
  });
}

/**
 * Published content for listings. Content volume is small (hundreds of items), so visible translations
 * are grouped in memory to sort by publication date across locales.
 */
export async function queryContentList(locale: Locale, query: ListContentQuery, now = new Date()) {
  const itemWhere: Prisma.ContentItemWhereInput = { type: query.type, ...(query.topic ? { topic: query.topic } : {}), ...(query.tag ? { tags: { has: query.tag } } : {}) };
  const q = query.q?.trim();
  const rows = await visibleTranslations(
    {
      contentItem: itemWhere,
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { summary: { contains: q, mode: "insensitive" } }] } : {}),
    },
    now,
  );
  const byItem = new Map<string, VisibleTranslation[]>();
  for (const r of rows) byItem.set(r.contentItemId, [...(byItem.get(r.contentItemId) ?? []), r]);
  const ordered = [...byItem.entries()]
    .map(([id, ts]) => ({ id, ...pick(ts, locale)! }))
    .sort((a, b) => effectiveDate(b.t).getTime() - effectiveDate(a.t).getTime());
  const total = ordered.length;
  const pageRows = ordered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
  return { items: await toCards(pageRows), total, page: query.page, pageSize: query.pageSize };
}

async function toCards(rows: { id: string; t: VisibleTranslation; isFallback: boolean }[]): Promise<ContentCard[]> {
  if (rows.length === 0) return [];
  const items = await db.contentItem.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: CARD_ITEM_SELECT });
  const byId = new Map(items.map((i) => [i.id, i]));
  return rows.flatMap(({ id, t, isFallback }) => {
    const item = byId.get(id);
    if (!item) return [];
    return [
      {
        id,
        type: item.type,
        slug: item.slug,
        topic: item.topic,
        tags: item.tags,
        coverMediaId: item.coverMediaId,
        videoUrl: item.videoUrl,
        featured: item.featured,
        authorName: item.author.name,
        title: t.title,
        summary: t.summary,
        readingMinutes: t.readingMinutes,
        publishedAt: effectiveDate(t),
        shownLocale: t.locale as Locale,
        isFallback,
      },
    ];
  });
}

/** Most recent featured item (listing hero); falls back to the newest item. */
export async function queryFeatured(locale: Locale, type: ContentType = "ARTICLE", now = new Date()) {
  const rows = await visibleTranslations({ contentItem: { type, featured: true } }, now);
  const list = rows.length ? rows : await visibleTranslations({ contentItem: { type } }, now);
  const byItem = new Map<string, VisibleTranslation[]>();
  for (const r of list) byItem.set(r.contentItemId, [...(byItem.get(r.contentItemId) ?? []), r]);
  const best = [...byItem.entries()].map(([id, ts]) => ({ id, ...pick(ts, locale)! })).sort((a, b) => effectiveDate(b.t).getTime() - effectiveDate(a.t).getTime())[0];
  return best ? ((await toCards([best]))[0] ?? null) : null;
}

/** Topic → number of published items (for filter chips). */
export async function queryTopicCounts(type: ContentType, now = new Date()) {
  const rows = await db.contentItem.findMany({ where: { type, translations: { some: visibleTranslation(now) } }, select: { topic: true } });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.topic] = (counts[r.topic] ?? 0) + 1;
  return counts;
}

export type ResolvedLink = { targetType: RelationTarget; targetId: string; title: string; href: string; summary: string | null };

/** Resolve relation targets to localized links, skipping anything unpublished or missing. */
export async function resolveTargets(targets: { targetType: RelationTarget; targetId: string }[], locale: Locale, now = new Date()): Promise<ResolvedLink[]> {
  const ids = (t: RelationTarget) => targets.filter((x) => x.targetType === t).map((x) => x.targetId);
  const hi = locale === "hi";
  const [contents, products, productCats, repairCats, specs, comparisons] = await Promise.all([
    ids("CONTENT").length
      ? db.contentItem.findMany({
          where: { id: { in: ids("CONTENT") } },
          select: { id: true, type: true, slug: true, translations: { where: visibleTranslation(now), select: { locale: true, title: true, summary: true } } },
        })
      : [],
    ids("PRODUCT").length ? db.product.findMany({ where: { id: { in: ids("PRODUCT") }, status: "ACTIVE" }, select: { id: true, slug: true, nameEn: true, nameHi: true, summaryEn: true, summaryHi: true } }) : [],
    ids("PRODUCT_CATEGORY").length
      ? db.productCategory.findMany({ where: { id: { in: ids("PRODUCT_CATEGORY") }, active: true }, select: { id: true, slug: true, nameEn: true, nameHi: true, descriptionEn: true, descriptionHi: true } })
      : [],
    ids("REPAIR_CATEGORY").length ? db.deviceCategory.findMany({ where: { id: { in: ids("REPAIR_CATEGORY") }, active: true }, select: { id: true, slug: true, nameEn: true, nameHi: true } }) : [],
    ids("DEVICE_SPEC").length
      ? db.deviceSpecification.findMany({
          where: { id: { in: ids("DEVICE_SPEC") }, ...visibleStatus(now) },
          select: { id: true, slug: true, summaryEn: true, summaryHi: true, deviceModel: { select: { name: true, brand: { select: { name: true } } } } },
        })
      : [],
    ids("COMPARISON").length
      ? db.deviceComparison.findMany({ where: { id: { in: ids("COMPARISON") }, ...visibleStatus(now) }, select: { id: true, slug: true, titleEn: true, titleHi: true, introEn: true, introHi: true } })
      : [],
  ]);
  const map = new Map<string, ResolvedLink>();
  const k = (t: RelationTarget, id: string) => `${t}:${id}`;
  for (const c of contents) {
    const p = pick(c.translations, locale);
    if (p) map.set(k("CONTENT", c.id), { targetType: "CONTENT", targetId: c.id, title: p.t.title, summary: p.t.summary, href: contentPath(locale, c.type, c.slug) });
  }
  for (const p of products)
    map.set(k("PRODUCT", p.id), { targetType: "PRODUCT", targetId: p.id, title: (hi && p.nameHi) || p.nameEn, summary: (hi && p.summaryHi) || p.summaryEn, href: `/${locale}/protection/${p.slug}` });
  for (const c of productCats)
    map.set(k("PRODUCT_CATEGORY", c.id), {
      targetType: "PRODUCT_CATEGORY",
      targetId: c.id,
      title: (hi && c.nameHi) || c.nameEn,
      summary: (hi && c.descriptionHi) || c.descriptionEn,
      href: `/${locale}/protection/products?category=${c.slug}`,
    });
  for (const c of repairCats)
    map.set(k("REPAIR_CATEGORY", c.id), { targetType: "REPAIR_CATEGORY", targetId: c.id, title: (hi && c.nameHi) || c.nameEn, summary: null, href: `/${locale}/repairs/book?category=${c.slug}` });
  for (const s of specs)
    map.set(k("DEVICE_SPEC", s.id), {
      targetType: "DEVICE_SPEC",
      targetId: s.id,
      title: deviceName(s.deviceModel.brand.name, s.deviceModel.name),
      summary: (hi && s.summaryHi) || s.summaryEn,
      href: `/${locale}/specs/${s.slug}`,
    });
  for (const c of comparisons)
    map.set(k("COMPARISON", c.id), { targetType: "COMPARISON", targetId: c.id, title: (hi && c.titleHi) || c.titleEn, summary: (hi && c.introHi) || c.introEn, href: `/${locale}/compare/${c.slug}` });
  return targets.flatMap((t) => map.get(k(t.targetType, t.targetId)) ?? []);
}

/** One published article/video with everything the detail page needs. */
export async function queryContentDetail(type: ContentType, slug: string, locale: Locale, now = new Date()) {
  const item = await db.contentItem.findUnique({
    where: { type_slug: { type, slug } },
    select: {
      ...CARD_ITEM_SELECT,
      createdAt: true,
      translations: {
        where: visibleTranslation(now),
        select: { locale: true, title: true, summary: true, body: true, seoTitle: true, metaDescription: true, readingMinutes: true, publishedAt: true, scheduledAt: true, updatedAt: true },
      },
      relations: { orderBy: { sortOrder: "asc" }, select: { targetType: true, targetId: true } },
    },
  });
  if (!item) return null;
  const chosen = pick(item.translations, locale);
  if (!chosen) return null;
  const t = chosen.t;
  const body = safeBlocks(t.body);

  // Explicit relations first, then auto-related by topic/tags (FR-CMS-08 interlinking).
  const explicit = await resolveTargets(item.relations, locale, now);
  const blockTargets = body.flatMap((b) => (b.type === "related" ? b.items : []));
  const blockLinks = blockTargets.length ? await resolveTargets(blockTargets, locale, now) : [];
  const autoRelated = await queryRelatedCards({ locale, type, topic: item.topic, tags: item.tags, excludeIds: [item.id, ...item.relations.filter((r) => r.targetType === "CONTENT").map((r) => r.targetId)], limit: 4, now });

  // Prev/next by publication date among same-type items.
  const all = await queryContentList(locale, { type, page: 1, pageSize: 500 }, now);
  const idx = all.items.findIndex((c) => c.id === item.id);
  const newer = idx > 0 ? all.items[idx - 1] : null;
  const older = idx >= 0 && idx < all.items.length - 1 ? all.items[idx + 1] : null;

  return {
    id: item.id,
    type: item.type,
    slug: item.slug,
    topic: item.topic,
    tags: item.tags,
    coverMediaId: item.coverMediaId,
    videoUrl: item.videoUrl,
    authorName: item.author.name,
    title: t.title,
    summary: t.summary,
    body,
    seoTitle: t.seoTitle,
    metaDescription: t.metaDescription,
    readingMinutes: t.readingMinutes,
    publishedAt: effectiveDate(t),
    updatedAt: t.updatedAt,
    shownLocale: t.locale as Locale,
    isFallback: chosen.isFallback,
    availableLocales: item.translations.map((x) => x.locale as Locale),
    explicitRelated: explicit,
    blockLinks,
    autoRelated,
    newer: newer ? { title: newer.title, href: contentPath(locale, type, newer.slug) } : null,
    older: older ? { title: older.title, href: contentPath(locale, type, older.slug) } : null,
  };
}
export type ContentDetail = NonNullable<Awaited<ReturnType<typeof queryContentDetail>>>;

/** Related published items scored by shared topic and tags. */
export async function queryRelatedCards({
  locale,
  type,
  topic,
  tags = [],
  excludeIds = [],
  limit = 3,
  now = new Date(),
}: {
  locale: Locale;
  type?: ContentType;
  topic?: string | null;
  tags?: string[];
  excludeIds?: string[];
  limit?: number;
  now?: Date;
}): Promise<ContentCard[]> {
  const candidates = await db.contentItem.findMany({
    where: {
      id: { notIn: excludeIds },
      ...(type ? { type } : {}),
      translations: { some: visibleTranslation(now) },
      ...(topic || tags.length ? { OR: [...(topic ? [{ topic }] : []), ...(tags.length ? [{ tags: { hasSome: tags } }] : [])] } : {}),
    },
    select: { id: true, topic: true, tags: true, translations: { where: visibleTranslation(now), select: { contentItemId: true, locale: true, title: true, summary: true, readingMinutes: true, publishedAt: true, scheduledAt: true, updatedAt: true } } },
    take: 60,
  });
  const scored = candidates
    .map((c) => ({ c, score: (c.topic === topic ? 2 : 0) + c.tags.filter((t) => tags.includes(t)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return toCards(scored.flatMap(({ c }) => {
    const p = pick(c.translations, locale);
    return p ? [{ id: c.id, ...p }] : [];
  }));
}

// ───────────── Specifications & comparisons ─────────────

const SPEC_CARD_SELECT = {
  id: true,
  slug: true,
  summaryEn: true,
  summaryHi: true,
  releaseDate: true,
  launchPricePaise: true,
  imageMediaId: true,
  specs: true,
  publishedAt: true,
  updatedAt: true,
  deviceModel: { select: { id: true, name: true, releaseYear: true, frame: true, model3d: MODEL3D_SELECT, brand: { select: { name: true, slug: true } }, category: { select: { slug: true } } } },
} as const;

export async function querySpecList({ q, brand }: { q?: string | null; brand?: string | null }, now = new Date()) {
  const terms = (q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const rows = await db.deviceSpecification.findMany({
    where: {
      ...visibleStatus(now),
      ...(brand ? { deviceModel: { brand: { slug: brand } } } : {}),
      ...(terms.length
        ? { AND: terms.map((t) => ({ OR: [{ deviceModel: { name: { contains: t, mode: "insensitive" as const } } }, { deviceModel: { brand: { name: { contains: t, mode: "insensitive" as const } } } }] })) }
        : {}),
    },
    orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }, { deviceModel: { name: "asc" } }],
    select: SPEC_CARD_SELECT,
  });
  return rows.map((r) => ({ ...r, specs: safeSpecs(r.specs) }));
}

export async function querySpecBrands(now = new Date()) {
  const rows = await db.deviceSpecification.findMany({ where: visibleStatus(now), select: { deviceModel: { select: { brand: { select: { name: true, slug: true } } } } } });
  const map = new Map(rows.map((r) => [r.deviceModel.brand.slug, r.deviceModel.brand.name]));
  return [...map.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function querySpecDetail(slug: string, now = new Date()) {
  const spec = await db.deviceSpecification.findFirst({
    where: { slug, ...visibleStatus(now) },
    select: { ...SPEC_CARD_SELECT, seoTitle: true, metaDescription: true, comparisons: { where: { comparison: visibleStatus(now) }, select: { comparison: { select: { id: true } } } } },
  });
  if (!spec) return null;
  return { ...spec, specs: safeSpecs(spec.specs) };
}
export type SpecDetail = NonNullable<Awaited<ReturnType<typeof querySpecDetail>>>;

/** Articles that explicitly link to this spec, then buying guides as a fallback. */
export async function queryArticlesForSpec(specId: string, locale: Locale, now = new Date()) {
  const rel = await db.contentRelation.findMany({ where: { targetType: "DEVICE_SPEC", targetId: specId }, select: { contentItemId: true } });
  const linked = rel.length ? await resolveTargets(rel.map((r) => ({ targetType: "CONTENT" as const, targetId: r.contentItemId })), locale, now) : [];
  const extra = linked.length < 3 ? await queryRelatedCards({ locale, type: "ARTICLE", topic: "buying-guides", excludeIds: rel.map((r) => r.contentItemId), limit: 3 - linked.length, now }) : [];
  return [...linked.map((l) => ({ title: l.title, href: l.href, summary: l.summary })), ...extra.map((c) => ({ title: c.title, href: contentPath(locale, c.type, c.slug), summary: c.summary }))];
}

/** Specs for 2–3 devices, by spec id or device model id, in the requested order. */
export async function queryCompare(ids: string[], now = new Date()) {
  const unique = [...new Set(ids)].slice(0, 3);
  const rows = await db.deviceSpecification.findMany({
    // AND, not spread: both clauses are OR filters and one would silently overwrite the other.
    where: { AND: [visibleStatus(now), { OR: [{ id: { in: unique } }, { deviceModelId: { in: unique } }, { slug: { in: unique } }] }] },
    select: SPEC_CARD_SELECT,
  });
  const order = (r: (typeof rows)[number]) => unique.findIndex((u) => u === r.id || u === r.deviceModel.id || u === r.slug);
  return rows.sort((a, b) => order(a) - order(b)).map((r) => ({ ...r, specs: safeSpecs(r.specs) }));
}

export async function queryComparisonDetail(slug: string, now = new Date()) {
  const c = await db.deviceComparison.findFirst({
    where: { slug, ...visibleStatus(now) },
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleHi: true,
      introEn: true,
      introHi: true,
      verdictEn: true,
      verdictHi: true,
      seoTitle: true,
      metaDescription: true,
      publishedAt: true,
      updatedAt: true,
      devices: { where: { spec: visibleStatus(now) }, orderBy: { sortOrder: "asc" }, select: { spec: { select: SPEC_CARD_SELECT } } },
    },
  });
  if (!c) return null;
  return { ...c, devices: c.devices.map(({ spec }) => ({ ...spec, specs: safeSpecs(spec.specs) })) };
}

export async function queryComparisonList(now = new Date()) {
  return db.deviceComparison.findMany({
    where: visibleStatus(now),
    orderBy: { publishedAt: "desc" },
    select: { id: true, slug: true, titleEn: true, titleHi: true, introEn: true, introHi: true, devices: { orderBy: { sortOrder: "asc" }, select: { spec: { select: { deviceModel: { select: { name: true, brand: { select: { name: true } } } } } } } } },
  });
}

/** Devices with published specs (for the compare picker). */
export async function queryCompareOptions(now = new Date()) {
  return db.deviceSpecification.findMany({
    where: visibleStatus(now),
    orderBy: [{ deviceModel: { brand: { name: "asc" } } }, { deviceModel: { name: "asc" } }],
    select: { id: true, slug: true, deviceModel: { select: { id: true, name: true, brand: { select: { name: true } } } } },
  });
}

// ───────────── Sitemap ─────────────

export async function querySitemapContent(now = new Date()) {
  const [items, specs, comparisons] = await Promise.all([
    db.contentItem.findMany({
      where: { translations: { some: visibleTranslation(now) } },
      select: { type: true, slug: true, updatedAt: true, translations: { where: visibleTranslation(now), select: { locale: true, updatedAt: true } } },
    }),
    db.deviceSpecification.findMany({ where: visibleStatus(now), select: { slug: true, updatedAt: true } }),
    db.deviceComparison.findMany({ where: visibleStatus(now), select: { slug: true, updatedAt: true } }),
  ]);
  return { items, specs, comparisons };
}
