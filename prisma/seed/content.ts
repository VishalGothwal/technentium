import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { readingMinutes } from "../../src/lib/content/reading";
import { ARTICLES, type SeedArticle } from "./content-articles";
import { COMPARISONS, SPEC_SHEETS, toSpecGroups } from "./content-specs";

const DAY = 86_400_000;

/**
 * Sample articles, videos, specifications and comparisons. Idempotent: items are upserted by slug,
 * so re-running refreshes the sample copy without duplicating anything. Relations are rebuilt.
 */
export async function seedContent(db: PrismaClient) {
  const author =
    (await db.user.findUnique({ where: { email: "editor@technentium.test" } })) ??
    (await db.user.findFirst({ where: { roles: { some: { role: { key: "owner" } } } } }));
  if (!author) {
    console.log("Content seed skipped: no editor or owner user.");
    return;
  }

  // ── Specifications ──
  const specIds = new Map<string, string>();
  for (const s of SPEC_SHEETS) {
    const model = await db.deviceModel.findFirst({ where: { slug: s.model, brand: { slug: s.brand } } });
    if (!model) continue;
    const slug = `${s.brand}-${s.model}`;
    const data = {
      slug,
      status: "PUBLISHED" as const,
      publishedAt: new Date(Date.now() - 20 * DAY),
      releaseDate: new Date(s.releaseDate),
      launchPricePaise: s.launchPricePaise,
      summaryEn: s.summaryEn,
      summaryHi: s.summaryHi ?? null,
      specs: toSpecGroups(s) as Prisma.InputJsonValue,
    };
    const row = await db.deviceSpecification.upsert({ where: { deviceModelId: model.id }, create: { deviceModelId: model.id, ...data }, update: data });
    specIds.set(slug, row.id);
  }

  // ── Comparisons ──
  for (const c of COMPARISONS) {
    const ids = c.specs.map((s) => specIds.get(s)).filter((x): x is string => !!x);
    if (ids.length < 2) continue;
    const data = {
      titleEn: c.titleEn,
      titleHi: c.titleHi ?? null,
      introEn: c.introEn,
      introHi: c.introHi ?? null,
      verdictEn: c.verdictEn,
      verdictHi: c.verdictHi ?? null,
      status: "PUBLISHED" as const,
      publishedAt: new Date(Date.now() - 15 * DAY),
    };
    const row = await db.deviceComparison.upsert({ where: { slug: c.slug }, create: { slug: c.slug, ...data }, update: data });
    await db.comparisonDevice.deleteMany({ where: { comparisonId: row.id } });
    await db.comparisonDevice.createMany({ data: ids.map((specId, i) => ({ comparisonId: row.id, specId, sortOrder: i })) });
  }

  // ── Articles & videos ──
  const itemIds = new Map<string, string>();
  for (const a of ARTICLES) {
    const type = a.type ?? "ARTICLE";
    const publishedAt = new Date(Date.now() - a.daysAgo * DAY);
    const item = await db.contentItem.upsert({
      where: { type_slug: { type, slug: a.slug } },
      create: { type, slug: a.slug, topic: a.topic, tags: a.tags, featured: !!a.featured, videoUrl: a.videoUrl ?? null, authorId: author.id, createdAt: publishedAt },
      update: { topic: a.topic, tags: a.tags, featured: !!a.featured, videoUrl: a.videoUrl ?? null },
    });
    itemIds.set(a.slug, item.id);
    for (const locale of ["en", "hi"] as const) {
      const tr = a[locale];
      if (!tr) continue;
      const data = {
        title: tr.title,
        summary: tr.summary,
        body: tr.body as Prisma.InputJsonValue,
        seoTitle: tr.seoTitle ?? null,
        metaDescription: tr.metaDescription ?? null,
        readingMinutes: readingMinutes(tr.body),
        status: "PUBLISHED" as const,
        publishedAt: locale === "hi" ? new Date(publishedAt.getTime() + DAY) : publishedAt,
      };
      await db.contentTranslation.upsert({
        where: { contentItemId_locale: { contentItemId: item.id, locale } },
        create: { contentItemId: item.id, locale, ...data },
        update: data,
      });
    }
  }

  // ── Relations (interlinking) ──
  const repairCats = await db.deviceCategory.findMany({ select: { id: true, slug: true } });
  const productCats = await db.productCategory.findMany({ where: { active: true }, select: { id: true, slug: true } });
  for (const a of ARTICLES) {
    const id = itemIds.get(a.slug)!;
    const targets: { targetType: "CONTENT" | "REPAIR_CATEGORY" | "DEVICE_SPEC" | "PRODUCT_CATEGORY" | "COMPARISON"; targetId: string }[] = [];
    for (const r of a.related ?? []) if (itemIds.has(r)) targets.push({ targetType: "CONTENT", targetId: itemIds.get(r)! });
    for (const c of a.repairCategories ?? []) {
      const cat = repairCats.find((x) => x.slug === c);
      if (cat) targets.push({ targetType: "REPAIR_CATEGORY", targetId: cat.id });
    }
    for (const hint of a.productCategoryHints ?? []) {
      const cat = productCats.find((x) => x.slug.includes(hint));
      if (cat && !targets.some((t) => t.targetId === cat.id)) targets.push({ targetType: "PRODUCT_CATEGORY", targetId: cat.id });
    }
    targets.push(...specTargetsFor(a, specIds));
    await db.contentRelation.deleteMany({ where: { contentItemId: id } });
    await db.contentRelation.createMany({ data: targets.map((t, i) => ({ contentItemId: id, ...t, sortOrder: i })), skipDuplicates: true });
  }

  // Buying guides link to the curated comparisons too.
  const comparisonRows = await db.deviceComparison.findMany({ select: { id: true } });
  const buying = itemIds.get("original-vs-compatible-parts");
  if (buying) {
    await db.contentRelation.createMany({
      data: comparisonRows.slice(0, 2).map((c, i) => ({ contentItemId: buying, targetType: "COMPARISON" as const, targetId: c.id, sortOrder: 50 + i })),
      skipDuplicates: true,
    });
  }
}

function specTargetsFor(a: SeedArticle, specIds: Map<string, string>) {
  return (a.specs ?? []).flatMap((s) => (specIds.has(s) ? [{ targetType: "DEVICE_SPEC" as const, targetId: specIds.get(s)! }] : []));
}
