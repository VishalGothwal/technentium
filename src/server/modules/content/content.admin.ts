import "server-only";
import { deviceName } from "@/lib/content/specs";
import type { ContentStatus, ContentType, Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db, type Tx } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { assertCan, can, type Actor } from "@/server/rbac/actor";
import { parse } from "@/server/validation";
import { readingMinutes } from "@/lib/content/reading";
import {
  createContentSchema,
  publishSchema,
  updateContentSchema,
  type ContentBlock,
  type RelationTarget,
  type TranslationInput,
} from "@/lib/schemas/content";
import { CONTENT_TAG, SPECS_TAG } from "./content.public";
import { safeBlocks } from "./content.queries";
import { invalidateContent } from "./invalidate";

const PAGE_SIZE = 20;

const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
const slugTaken = () => new AppError("CONFLICT", "articles.errors.slugTaken", { fields: { slug: "articles.errors.slugTaken" } });

function translationData(t: TranslationInput) {
  return {
    title: t.title,
    summary: t.summary,
    body: t.body as Prisma.InputJsonValue,
    seoTitle: t.seoTitle || null,
    metaDescription: t.metaDescription || null,
    readingMinutes: readingMinutes(t.body),
  };
}

async function snapshot(tx: Tx, translationId: string, actor: Actor) {
  const t = await tx.contentTranslation.findUniqueOrThrow({ where: { id: translationId } });
  await tx.contentRevision.create({
    data: {
      translationId,
      authorId: actor.userId,
      snapshot: { title: t.title, summary: t.summary, body: t.body, seoTitle: t.seoTitle, metaDescription: t.metaDescription } as Prisma.InputJsonValue,
    },
  });
}

// ───────────── Reads ─────────────

export async function listContentAdmin(
  actor: Actor | null,
  f: { type?: ContentType; status?: ContentStatus; locale?: string; topic?: string; q?: string; page?: number },
) {
  assertCan(actor, "content.edit");
  const page = Math.max(1, f.page ?? 1);
  const tWhere: Prisma.ContentTranslationWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.locale ? { locale: f.locale } : {}),
    ...(f.q ? { title: { contains: f.q, mode: "insensitive" } } : {}),
  };
  const hasT = Object.keys(tWhere).length > 0;
  const where: Prisma.ContentItemWhereInput = {
    ...(f.type ? { type: f.type } : {}),
    ...(f.topic ? { topic: f.topic } : {}),
    ...(hasT ? { OR: [{ translations: { some: tWhere } }, ...(f.q ? [{ slug: { contains: f.q.toLowerCase() } }] : [])] } : {}),
  };
  const [items, total] = await Promise.all([
    db.contentItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        slug: true,
        topic: true,
        featured: true,
        updatedAt: true,
        author: { select: { name: true } },
        translations: { select: { locale: true, title: true, status: true, scheduledAt: true, publishedAt: true }, orderBy: { locale: "asc" } },
      },
    }),
    db.contentItem.count({ where }),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE };
}

export async function getContentForEdit(actor: Actor | null, id: string) {
  assertCan(actor, "content.edit");
  const item = await db.contentItem.findUnique({
    where: { id },
    include: {
      author: { select: { name: true } },
      translations: { include: { revisions: { orderBy: { createdAt: "desc" }, take: 15, select: { id: true, createdAt: true, authorId: true } } } },
      relations: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!item) throw notFound("content");
  const authorIds = [...new Set(item.translations.flatMap((t) => t.revisions.map((r) => r.authorId)))];
  const authors = await db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } });
  const names = new Map(authors.map((a) => [a.id, a.name]));
  return {
    ...item,
    translations: item.translations.map((t) => ({ ...t, body: safeBlocks(t.body), revisions: t.revisions.map((r) => ({ ...r, authorName: names.get(r.authorId) ?? "—" })) })),
  };
}

// ───────────── Writes ─────────────

export async function createContent(actor: Actor | null, input: unknown) {
  assertCan(actor, "content.edit");
  const data = parse(createContentSchema, input);
  try {
    const created = await db.$transaction(async (tx) => {
      const item = await tx.contentItem.create({
        data: {
          type: data.type,
          slug: data.slug,
          topic: data.topic,
          tags: data.tags,
          coverMediaId: data.coverMediaId ?? null,
          videoUrl: data.videoUrl ?? null,
          featured: data.featured,
          authorId: actor.userId,
          translations: { create: { locale: data.locale, ...translationData(data.translation) } },
        },
        include: { translations: { select: { id: true } } },
      });
      await snapshot(tx, item.translations[0]!.id, actor);
      await audit(tx, actor, { action: "content.create", entityType: "ContentItem", entityId: item.id, after: { type: item.type, slug: item.slug, locale: data.locale } });
      return item;
    });
    invalidateContent(CONTENT_TAG);
    return { id: created.id, slug: created.slug, type: created.type };
  } catch (e) {
    if (isUniqueViolation(e)) throw slugTaken();
    throw e;
  }
}

export async function updateContent(actor: Actor | null, id: string, input: unknown) {
  assertCan(actor, "content.edit");
  const data = parse(updateContentSchema, input);
  const existing = await db.contentItem.findUnique({ where: { id }, include: { translations: true } });
  if (!existing) throw notFound("content");
  if (data.expectedUpdatedAt && new Date(data.expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
    throw new AppError("CONFLICT", "errors.conflict.stale");
  }
  if (data.relations?.some((r) => r.targetType === "CONTENT" && r.targetId === id)) {
    throw new AppError("VALIDATION", "errors.validation", { fields: { relations: "articles.validation.selfRelation" } });
  }
  const nextType = existing.type;
  const nextVideoUrl = data.item?.videoUrl !== undefined ? data.item.videoUrl : existing.videoUrl;
  if (nextType === "VIDEO" && !nextVideoUrl) throw new AppError("VALIDATION", "errors.validation", { fields: { videoUrl: "articles.validation.videoRequired" } });

  try {
    await db.$transaction(async (tx) => {
      const it = data.item ?? {};
      await tx.contentItem.update({
        where: { id },
        data: {
          ...(it.slug !== undefined ? { slug: it.slug } : {}),
          ...(it.topic !== undefined ? { topic: it.topic } : {}),
          ...(it.tags !== undefined ? { tags: it.tags } : {}),
          ...(it.coverMediaId !== undefined ? { coverMediaId: it.coverMediaId ?? null } : {}),
          ...(it.videoUrl !== undefined ? { videoUrl: it.videoUrl ?? null } : {}),
          ...(it.featured !== undefined ? { featured: it.featured } : {}),
          updatedAt: new Date(),
        },
      });
      for (const [locale, t] of Object.entries(data.translations ?? {})) {
        if (!t) continue;
        const row = await tx.contentTranslation.upsert({
          where: { contentItemId_locale: { contentItemId: id, locale } },
          create: { contentItemId: id, locale, ...translationData(t) },
          update: translationData(t),
        });
        await snapshot(tx, row.id, actor);
      }
      if (data.relations) {
        await tx.contentRelation.deleteMany({ where: { contentItemId: id } });
        if (data.relations.length) {
          const unique = [...new Map(data.relations.map((r) => [`${r.targetType}:${r.targetId}`, r])).values()];
          await tx.contentRelation.createMany({ data: unique.map((r, i) => ({ contentItemId: id, targetType: r.targetType, targetId: r.targetId, sortOrder: i })) });
        }
      }
      await audit(tx, actor, {
        action: "content.update",
        entityType: "ContentItem",
        entityId: id,
        before: { slug: existing.slug, topic: existing.topic },
        after: { ...data.item, locales: Object.keys(data.translations ?? {}), relations: data.relations?.length },
      });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw slugTaken();
    throw e;
  }
  invalidateContent(CONTENT_TAG, `content:${existing.type}:${existing.slug}`);
  return { id };
}

/** Publish / schedule / unpublish / archive one locale independently (FR-CMS-04/05, FR-CMS-09). */
export async function setPublishState(actor: Actor | null, id: string, input: unknown) {
  assertCan(actor, "content.publish");
  const data = parse(publishSchema, input);
  const t = await db.contentTranslation.findUnique({ where: { contentItemId_locale: { contentItemId: id, locale: data.locale } }, include: { contentItem: true } });
  if (!t) throw notFound("content");

  if (data.action === "publish" || data.action === "schedule") {
    const body = safeBlocks(t.body);
    if (!t.title.trim() || !t.summary.trim() || body.length === 0) throw new AppError("VALIDATION", "articles.errors.incomplete");
  }
  const now = new Date();
  const next: Prisma.ContentTranslationUpdateInput =
    data.action === "publish"
      ? { status: "PUBLISHED", publishedAt: t.publishedAt && t.status === "PUBLISHED" ? t.publishedAt : now, scheduledAt: null }
      : data.action === "schedule"
        ? { status: "SCHEDULED", scheduledAt: new Date(data.scheduledAt!), publishedAt: new Date(data.scheduledAt!) }
        : data.action === "unpublish"
          ? { status: "DRAFT", scheduledAt: null }
          : { status: "ARCHIVED", scheduledAt: null };

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.contentTranslation.update({ where: { id: t.id }, data: next, select: { status: true, publishedAt: true, scheduledAt: true, locale: true } });
    await tx.contentItem.update({ where: { id }, data: { updatedAt: now } });
    await audit(tx, actor, { action: `content.${data.action}`, entityType: "ContentItem", entityId: id, before: { locale: t.locale, status: t.status }, after: row });
    return row;
  });
  invalidateContent(CONTENT_TAG, `content:${t.contentItem.type}:${t.contentItem.slug}`);
  return updated;
}

export async function restoreRevision(actor: Actor | null, revisionId: string) {
  assertCan(actor, "content.edit");
  const rev = await db.contentRevision.findUnique({ where: { id: revisionId }, include: { translation: { include: { contentItem: true } } } });
  if (!rev) throw notFound("content");
  const s = rev.snapshot as { title: string; summary: string; body: unknown; seoTitle: string | null; metaDescription: string | null };
  const body = safeBlocks(s.body);
  await db.$transaction(async (tx) => {
    await tx.contentTranslation.update({
      where: { id: rev.translationId },
      data: { title: s.title, summary: s.summary, body: body as Prisma.InputJsonValue, seoTitle: s.seoTitle, metaDescription: s.metaDescription, readingMinutes: readingMinutes(body) },
    });
    await snapshot(tx, rev.translationId, actor);
    await audit(tx, actor, { action: "content.restore", entityType: "ContentItem", entityId: rev.translation.contentItemId, after: { revisionId, locale: rev.translation.locale } });
  });
  invalidateContent(CONTENT_TAG, `content:${rev.translation.contentItem.type}:${rev.translation.contentItem.slug}`);
  return { id: rev.translation.contentItemId };
}

/** Draft rendering for staff preview (FR-CMS-07): ignores publication state. */
export async function getPreview(actor: Actor | null, id: string, locale: string) {
  assertCan(actor, "content.edit");
  const item = await db.contentItem.findUnique({
    where: { id },
    include: { author: { select: { name: true } }, translations: { where: { locale } }, relations: { orderBy: { sortOrder: "asc" } } },
  });
  const t = item?.translations[0];
  if (!item || !t) throw notFound("content");
  return { item, t: { ...t, body: safeBlocks(t.body) as ContentBlock[] } };
}

// ───────────── Relation picker ─────────────

export type RelationOption = { targetType: RelationTarget; targetId: string; label: string; hint: string };

/** Search across everything an article can link to (articles, products, repair categories, specs, comparisons). */
export async function searchRelationTargets(actor: Actor | null, q: string): Promise<RelationOption[]> {
  assertCan(actor, "content.edit");
  const term = q.trim();
  const contains = { contains: term, mode: "insensitive" as const };
  const [contents, products, productCats, repairCats, specs, comparisons] = await Promise.all([
    db.contentItem.findMany({
      where: term ? { OR: [{ slug: { contains: term.toLowerCase() } }, { translations: { some: { title: contains } } }] } : {},
      take: 8,
      orderBy: { updatedAt: "desc" },
      select: { id: true, type: true, slug: true, translations: { select: { locale: true, title: true } } },
    }),
    db.product.findMany({ where: { status: { not: "ARCHIVED" }, ...(term ? { OR: [{ nameEn: contains }, { sku: contains }] } : {}) }, take: 6, select: { id: true, nameEn: true, sku: true } }),
    db.productCategory.findMany({ where: term ? { nameEn: contains } : {}, take: 4, select: { id: true, nameEn: true } }),
    db.deviceCategory.findMany({ where: term ? { nameEn: contains } : {}, take: 4, select: { id: true, nameEn: true } }),
    db.deviceSpecification.findMany({
      where: term ? { OR: [{ deviceModel: { name: contains } }, { deviceModel: { brand: { name: contains } } }] } : {},
      take: 6,
      select: { id: true, deviceModel: { select: { name: true, brand: { select: { name: true } } } } },
    }),
    db.deviceComparison.findMany({ where: term ? { titleEn: contains } : {}, take: 4, select: { id: true, titleEn: true } }),
  ]);
  return [
    ...contents.map((c) => ({
      targetType: "CONTENT" as const,
      targetId: c.id,
      label: (c.translations.find((t) => t.locale === "en") ?? c.translations[0])?.title ?? c.slug,
      hint: c.type === "VIDEO" ? "Video" : "Article",
    })),
    ...products.map((p) => ({ targetType: "PRODUCT" as const, targetId: p.id, label: p.nameEn, hint: `Product · ${p.sku}` })),
    ...productCats.map((c) => ({ targetType: "PRODUCT_CATEGORY" as const, targetId: c.id, label: c.nameEn, hint: "Product category" })),
    ...repairCats.map((c) => ({ targetType: "REPAIR_CATEGORY" as const, targetId: c.id, label: `Repair: ${c.nameEn}`, hint: "Repair service" })),
    ...specs.map((s) => ({ targetType: "DEVICE_SPEC" as const, targetId: s.id, label: deviceName(s.deviceModel.brand.name, s.deviceModel.name), hint: "Specifications" })),
    ...comparisons.map((c) => ({ targetType: "COMPARISON" as const, targetId: c.id, label: c.titleEn, hint: "Comparison" })),
  ];
}

/** Labels for already-selected relations (editor display). */
export async function describeTargets(actor: Actor | null, targets: { targetType: RelationTarget; targetId: string }[]): Promise<RelationOption[]> {
  assertCan(actor, "content.edit");
  if (!targets.length) return [];
  const ids = (t: RelationTarget) => targets.filter((x) => x.targetType === t).map((x) => x.targetId);
  const [contents, products, productCats, repairCats, specs, comparisons] = await Promise.all([
    db.contentItem.findMany({ where: { id: { in: ids("CONTENT") } }, select: { id: true, slug: true, type: true, translations: { select: { locale: true, title: true } } } }),
    db.product.findMany({ where: { id: { in: ids("PRODUCT") } }, select: { id: true, nameEn: true } }),
    db.productCategory.findMany({ where: { id: { in: ids("PRODUCT_CATEGORY") } }, select: { id: true, nameEn: true } }),
    db.deviceCategory.findMany({ where: { id: { in: ids("REPAIR_CATEGORY") } }, select: { id: true, nameEn: true } }),
    db.deviceSpecification.findMany({ where: { id: { in: ids("DEVICE_SPEC") } }, select: { id: true, deviceModel: { select: { name: true, brand: { select: { name: true } } } } } }),
    db.deviceComparison.findMany({ where: { id: { in: ids("COMPARISON") } }, select: { id: true, titleEn: true } }),
  ]);
  const labels = new Map<string, [string, string]>();
  for (const c of contents) labels.set(`CONTENT:${c.id}`, [(c.translations.find((t) => t.locale === "en") ?? c.translations[0])?.title ?? c.slug, c.type === "VIDEO" ? "Video" : "Article"]);
  for (const p of products) labels.set(`PRODUCT:${p.id}`, [p.nameEn, "Product"]);
  for (const c of productCats) labels.set(`PRODUCT_CATEGORY:${c.id}`, [c.nameEn, "Product category"]);
  for (const c of repairCats) labels.set(`REPAIR_CATEGORY:${c.id}`, [`Repair: ${c.nameEn}`, "Repair service"]);
  for (const s of specs) labels.set(`DEVICE_SPEC:${s.id}`, [deviceName(s.deviceModel.brand.name, s.deviceModel.name), "Specifications"]);
  for (const c of comparisons) labels.set(`COMPARISON:${c.id}`, [c.titleEn, "Comparison"]);
  return targets.map((t) => {
    const [label, hint] = labels.get(`${t.targetType}:${t.targetId}`) ?? ["(missing)", t.targetType];
    return { ...t, label, hint };
  });
}

export const canPublish = (actor: Actor | null) => can(actor, "content.publish");

/** Re-export so admin pages can invalidate spec caches after spec edits. */
export { SPECS_TAG };
