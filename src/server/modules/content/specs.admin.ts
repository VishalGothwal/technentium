import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { parse } from "@/server/validation";
import { comparisonInputSchema, specInputSchema, specStatusSchema } from "@/lib/schemas/content";
import { CONTENT_TAG, SPECS_TAG } from "./content.public";
import { safeSpecs } from "./content.queries";
import { invalidateContent } from "./invalidate";

const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";

export async function listSpecsAdmin(actor: Actor | null, q?: string) {
  assertCan(actor, "content.edit");
  const contains = { contains: q ?? "", mode: "insensitive" as const };
  const [specs, comparisons] = await Promise.all([
    db.deviceSpecification.findMany({
      where: q ? { OR: [{ deviceModel: { name: contains } }, { deviceModel: { brand: { name: contains } } }] } : {},
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true, status: true, updatedAt: true, specs: true, deviceModel: { select: { name: true, brand: { select: { name: true } } } } },
    }),
    db.deviceComparison.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, slug: true, titleEn: true, status: true, updatedAt: true, _count: { select: { devices: true } } } }),
  ]);
  return {
    specs: specs.map((s) => {
      const items = safeSpecs(s.specs).flatMap((g) => g.items);
      return { ...s, specs: undefined, filled: items.filter((i) => i.value !== null).length, totalFields: items.length };
    }),
    comparisons,
  };
}

/** Device models without a spec sheet yet (new-spec picker). */
export async function modelsWithoutSpecs(actor: Actor | null) {
  assertCan(actor, "content.edit");
  return db.deviceModel.findMany({
    where: { active: true, specification: null },
    orderBy: [{ category: { sortOrder: "asc" } }, { brand: { name: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, slug: true, brand: { select: { name: true, slug: true } }, category: { select: { nameEn: true } } },
  });
}

export async function getSpecForEdit(actor: Actor | null, id: string) {
  assertCan(actor, "content.edit");
  const spec = await db.deviceSpecification.findUnique({ where: { id }, include: { deviceModel: { select: { id: true, name: true, brand: { select: { name: true } } } } } });
  if (!spec) throw notFound("content");
  return { ...spec, specs: safeSpecs(spec.specs) };
}

function specData(d: ReturnType<typeof specInputSchema.parse>) {
  return {
    slug: d.slug,
    releaseDate: d.releaseDate ? new Date(d.releaseDate) : null,
    launchPricePaise: d.launchPricePaise ?? null,
    summaryEn: d.summaryEn || null,
    summaryHi: d.summaryHi || null,
    specs: d.specs as Prisma.InputJsonValue,
    imageMediaId: d.imageMediaId ?? null,
    seoTitle: d.seoTitle || null,
    metaDescription: d.metaDescription || null,
  };
}

/** Create (no id) or update a spec sheet. Unknown values stay `null` (FR-SPEC-04). */
export async function saveSpec(actor: Actor | null, id: string | null, input: unknown) {
  assertCan(actor, "content.edit");
  const d = parse(specInputSchema, input);
  try {
    const row = await db.$transaction(async (tx) => {
      const saved = id
        ? await tx.deviceSpecification.update({ where: { id }, data: specData(d) })
        : await tx.deviceSpecification.create({ data: { deviceModelId: d.deviceModelId, ...specData(d) } });
      await audit(tx, actor, { action: id ? "spec.update" : "spec.create", entityType: "DeviceSpecification", entityId: saved.id, after: { slug: saved.slug } });
      return saved;
    });
    invalidateContent(SPECS_TAG, CONTENT_TAG);
    return { id: row.id, slug: row.slug };
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("CONFLICT", "articles.errors.slugTaken", { fields: { slug: "articles.errors.slugTaken" } });
    throw e;
  }
}

export async function setSpecStatus(actor: Actor | null, id: string, input: unknown) {
  assertCan(actor, "content.publish");
  const { action } = parse(specStatusSchema, input);
  const spec = await db.deviceSpecification.findUnique({ where: { id } });
  if (!spec) throw notFound("content");
  const status = action === "publish" ? "PUBLISHED" : action === "unpublish" ? "DRAFT" : "ARCHIVED";
  await db.$transaction(async (tx) => {
    await tx.deviceSpecification.update({ where: { id }, data: { status, publishedAt: action === "publish" ? (spec.publishedAt ?? new Date()) : spec.publishedAt } });
    await audit(tx, actor, { action: `spec.${action}`, entityType: "DeviceSpecification", entityId: id, before: { status: spec.status }, after: { status } });
  });
  invalidateContent(SPECS_TAG, CONTENT_TAG);
  return { status };
}

// ───────────── Comparisons ─────────────

export async function getComparisonForEdit(actor: Actor | null, id: string) {
  assertCan(actor, "content.edit");
  const c = await db.deviceComparison.findUnique({ where: { id }, include: { devices: { orderBy: { sortOrder: "asc" }, select: { specId: true } } } });
  if (!c) throw notFound("content");
  return c;
}

export async function specOptions(actor: Actor | null) {
  assertCan(actor, "content.edit");
  return db.deviceSpecification.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: [{ deviceModel: { brand: { name: "asc" } } }, { deviceModel: { name: "asc" } }],
    select: { id: true, status: true, deviceModel: { select: { name: true, brand: { select: { name: true } } } } },
  });
}

export async function saveComparison(actor: Actor | null, id: string | null, input: unknown) {
  assertCan(actor, "content.edit");
  const d = parse(comparisonInputSchema, input);
  if (new Set(d.specIds).size !== d.specIds.length) throw new AppError("VALIDATION", "errors.validation", { fields: { specIds: "compare.validation.devices" } });
  const data = {
    slug: d.slug,
    titleEn: d.titleEn,
    titleHi: d.titleHi || null,
    introEn: d.introEn || null,
    introHi: d.introHi || null,
    verdictEn: d.verdictEn || null,
    verdictHi: d.verdictHi || null,
    seoTitle: d.seoTitle || null,
    metaDescription: d.metaDescription || null,
  };
  try {
    const row = await db.$transaction(async (tx) => {
      const saved = id ? await tx.deviceComparison.update({ where: { id }, data }) : await tx.deviceComparison.create({ data });
      await tx.comparisonDevice.deleteMany({ where: { comparisonId: saved.id } });
      await tx.comparisonDevice.createMany({ data: d.specIds.map((specId, i) => ({ comparisonId: saved.id, specId, sortOrder: i })) });
      await audit(tx, actor, { action: id ? "comparison.update" : "comparison.create", entityType: "DeviceComparison", entityId: saved.id, after: { slug: saved.slug, specIds: d.specIds } });
      return saved;
    });
    invalidateContent(SPECS_TAG, CONTENT_TAG);
    return { id: row.id, slug: row.slug };
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("CONFLICT", "articles.errors.slugTaken", { fields: { slug: "articles.errors.slugTaken" } });
    throw e;
  }
}

export async function setComparisonStatus(actor: Actor | null, id: string, input: unknown) {
  assertCan(actor, "content.publish");
  const { action } = parse(specStatusSchema, input);
  const c = await db.deviceComparison.findUnique({ where: { id } });
  if (!c) throw notFound("content");
  const status = action === "publish" ? "PUBLISHED" : action === "unpublish" ? "DRAFT" : "ARCHIVED";
  await db.$transaction(async (tx) => {
    await tx.deviceComparison.update({ where: { id }, data: { status, publishedAt: action === "publish" ? (c.publishedAt ?? new Date()) : c.publishedAt } });
    await audit(tx, actor, { action: `comparison.${action}`, entityType: "DeviceComparison", entityId: id, before: { status: c.status }, after: { status } });
  });
  invalidateContent(SPECS_TAG, CONTENT_TAG);
  return { status };
}
