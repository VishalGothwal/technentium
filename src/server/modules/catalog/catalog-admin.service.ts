import "server-only";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { parseCsv } from "@/lib/csv";
import { deviceSlug } from "@/lib/device-name";
import { FRAME_KEYS } from "@/lib/device-frames";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { parse } from "@/server/validation";

/** Device catalogue administration (categories, brands, models, issue types, price items). */

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80);

export async function catalogTree(actor: Actor | null) {
  assertCan(actor, "catalog.manage", "quote.manage", "settings.fees");
  return db.deviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    include: {
      brands: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { models: { orderBy: { name: "asc" } } } },
      issues: { orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] },
    },
  });
}

const brandSchema = z.object({ id: z.string().optional(), categoryId: z.string().min(1), name: z.string().trim().min(1).max(60), active: z.boolean().default(true) });
const aliasList = z.array(z.string().trim().toLowerCase().min(2).max(30)).max(10);
/** Optional fields are left untouched on update when omitted (the quick name editor only sends name + active). */
const modelSchema = z.object({
  id: z.string().optional(),
  brandId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  active: z.boolean().default(true),
  releaseYear: z.int().min(2000).max(2100).nullish(),
  popular: z.boolean().optional(),
  frame: z.enum(FRAME_KEYS).nullish(),
  aliases: aliasList.optional(),
});
const issueSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1),
  nameEn: z.string().trim().min(2).max(80),
  nameHi: z.string().trim().max(80).optional().default(""),
  descriptionEn: z.string().trim().max(300).optional().default(""),
  descriptionHi: z.string().trim().max(300).optional().default(""),
  active: z.boolean().default(true),
});
const priceItemSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(["LABOUR", "PART", "DIAGNOSIS_FEE", "DISCOUNT", "OTHER"]),
  name: z.string().trim().min(2).max(120),
  unitPaise: z.int().min(0).max(10_000_00),
  partGrade: z.string().trim().max(40).nullish(),
  modelId: z.string().nullish(),
  issueTypeId: z.string().nullish(),
  active: z.boolean().default(true),
});

export async function upsertBrand(actor: Actor | null, raw: unknown) {
  assertCan(actor, "catalog.manage");
  const { id, ...d } = parse(brandSchema, raw);
  await db.$transaction(async (tx) => {
    const data = { ...d, slug: slugify(d.name) };
    const row = id ? await tx.deviceBrand.update({ where: { id }, data }) : await tx.deviceBrand.create({ data });
    await audit(tx, actor, { action: "catalog.brand", entityType: "DeviceBrand", entityId: row.id, after: data });
  });
}

export async function upsertModel(actor: Actor | null, raw: unknown) {
  assertCan(actor, "catalog.manage");
  const { id, ...d } = parse(modelSchema, raw);
  await db.$transaction(async (tx) => {
    const brand = await tx.deviceBrand.findUniqueOrThrow({ where: { id: d.brandId }, select: { categoryId: true } });
    // Keep an existing model's slug (its public URL) unless it is renamed.
    const current = id ? await tx.deviceModel.findUniqueOrThrow({ where: { id }, select: { name: true, slug: true } }) : null;
    const slug = current && current.name === d.name ? current.slug : deviceSlug(d.name);
    const data = { ...d, slug, categoryId: brand.categoryId };
    const row = id ? await tx.deviceModel.update({ where: { id }, data }) : await tx.deviceModel.create({ data });
    await audit(tx, actor, { action: "catalog.model", entityType: "DeviceModel", entityId: row.id, after: data });
  });
}

export async function upsertIssue(actor: Actor | null, raw: unknown) {
  assertCan(actor, "catalog.manage");
  const { id, ...d } = parse(issueSchema, raw);
  await db.$transaction(async (tx) => {
    const data = { ...d, slug: slugify(d.nameEn), nameHi: d.nameHi || null, descriptionEn: d.descriptionEn || null, descriptionHi: d.descriptionHi || null };
    const row = id ? await tx.repairIssueType.update({ where: { id }, data }) : await tx.repairIssueType.create({ data });
    await audit(tx, actor, { action: "catalog.issue", entityType: "RepairIssueType", entityId: row.id, after: data });
  });
}

export async function listPriceItemsAdmin(actor: Actor | null) {
  assertCan(actor, "catalog.manage", "settings.fees");
  return db.priceItem.findMany({
    orderBy: [{ active: "desc" }, { kind: "asc" }, { name: "asc" }],
    include: { model: { select: { name: true } }, issueType: { select: { nameEn: true } } },
  });
}

export async function upsertPriceItem(actor: Actor | null, raw: unknown) {
  assertCan(actor, "catalog.manage", "settings.fees");
  const { id, ...d } = parse(priceItemSchema, raw);
  const data = { ...d, partGrade: d.partGrade || null, modelId: d.modelId || null, issueTypeId: d.issueTypeId || null };
  await db.$transaction(async (tx) => {
    const row = id ? await tx.priceItem.update({ where: { id }, data }) : await tx.priceItem.create({ data });
    await audit(tx, actor, { action: "catalog.price_item", entityType: "PriceItem", entityId: row.id, after: data });
  });
}

const estimateSchema = z
  .object({
    id: z.string().optional(),
    issueTypeId: z.string().min(1),
    modelId: z.string().nullish(),
    minPaise: z.int().min(0).max(10_000_00),
    maxPaise: z.int().min(0).max(10_000_00).nullish(),
    active: z.boolean().default(true),
  })
  .refine((d) => d.maxPaise == null || d.maxPaise >= d.minPaise, { path: ["maxPaise"], message: "validation.invalid" });

/** Public repair estimates shown on model pages (issue-wide defaults and per-model overrides). */
export async function listEstimatesAdmin(actor: Actor | null) {
  assertCan(actor, "catalog.manage", "settings.fees");
  return db.repairEstimate.findMany({
    orderBy: [{ issueType: { category: { sortOrder: "asc" } } }, { issueType: { sortOrder: "asc" } }, { modelId: { sort: "asc", nulls: "first" } }],
    include: { model: { select: { name: true, brand: { select: { name: true } } } }, issueType: { select: { nameEn: true, category: { select: { nameEn: true } } } } },
  });
}

export async function upsertEstimate(actor: Actor | null, raw: unknown) {
  assertCan(actor, "catalog.manage", "settings.fees");
  const { id, ...d } = parse(estimateSchema, raw);
  const data = { ...d, modelId: d.modelId || null, maxPaise: d.maxPaise ?? null };
  await db.$transaction(async (tx) => {
    // The unique index treats NULL modelIds as distinct, so match an existing issue-wide default by hand.
    const existing = id ? { id } : await tx.repairEstimate.findFirst({ where: { issueTypeId: data.issueTypeId, modelId: data.modelId }, select: { id: true } });
    const row = existing ? await tx.repairEstimate.update({ where: { id: existing.id }, data }) : await tx.repairEstimate.create({ data });
    await audit(tx, actor, { action: "catalog.estimate", entityType: "RepairEstimate", entityId: row.id, after: data });
  });
}

// ───────────── CSV import ─────────────

export const MODEL_CSV_COLUMNS = ["category", "brand", "model", "releaseYear", "frame", "popular", "aliases"] as const;
const MAX_IMPORT_ROWS = 3000;

const csvRow = z.object({
  category: z.string().min(1, "category is required"),
  brand: z.string().min(1, "brand is required").max(60),
  model: z.string().min(1, "model is required").max(80),
  releaseYear: z.union([z.literal(""), z.coerce.number().int().min(2000).max(2100)]),
  frame: z.union([z.literal(""), z.enum(FRAME_KEYS)]),
  popular: z.union([z.literal(""), z.enum(["yes", "no", "true", "false", "1", "0", "y", "n"])]),
  aliases: z.string().max(300),
});

export type ImportResult = { created: number; updated: number; brandsCreated: number; errors: { line: number; message: string }[]; applied: boolean };

/**
 * Bulk add/update device models from CSV (header row required; columns: category slug, brand, model,
 * releaseYear, frame, popular, aliases separated by ";"). With `apply` false it only reports what would change.
 * Existing models are matched by brand + name (or slug), so re-importing the same file is safe.
 */
export async function importModelsCsv(actor: Actor | null, raw: unknown): Promise<ImportResult> {
  assertCan(actor, "catalog.manage");
  const input = parse(z.object({ csv: z.string().min(1).max(1_000_000), apply: z.boolean() }), raw);
  const csv = input.csv;
  let apply = input.apply;
  const [header, ...lines] = parseCsv(csv);
  const cols = (header ?? []).map((h) => h.trim());
  const errors: ImportResult["errors"] = [];
  const missing = MODEL_CSV_COLUMNS.filter((c) => !["releaseYear", "frame", "popular", "aliases"].includes(c) && !cols.includes(c));
  if (missing.length) return { created: 0, updated: 0, brandsCreated: 0, errors: [{ line: 1, message: `Missing columns: ${missing.join(", ")}` }], applied: false };
  if (lines.length > MAX_IMPORT_ROWS) return { created: 0, updated: 0, brandsCreated: 0, errors: [{ line: 1, message: `At most ${MAX_IMPORT_ROWS} rows per import` }], applied: false };

  const categories = new Map((await db.deviceCategory.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));
  const rows = lines.flatMap((cells, i) => {
    const line = i + 2;
    const obj = Object.fromEntries(MODEL_CSV_COLUMNS.map((c) => [c, cells[cols.indexOf(c)] ?? ""]));
    const r = csvRow.safeParse(obj);
    if (!r.success) {
      errors.push({ line, message: r.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") });
      return [];
    }
    const categoryId = categories.get(r.data.category);
    if (!categoryId) {
      errors.push({ line, message: `Unknown category "${r.data.category}"` });
      return [];
    }
    const aliases = r.data.aliases.split(";").map((a) => a.trim().toLowerCase()).filter((a) => a.length >= 2).slice(0, 10);
    return [
      {
        line,
        categoryId,
        brand: r.data.brand,
        name: r.data.model,
        releaseYear: r.data.releaseYear === "" ? undefined : r.data.releaseYear,
        frame: r.data.frame === "" ? undefined : r.data.frame,
        popular: r.data.popular === "" ? undefined : ["yes", "true", "1", "y"].includes(r.data.popular),
        aliases: aliases.length ? aliases : undefined,
      },
    ];
  });

  // A file with errors is only ever previewed, never half-applied.
  if (errors.length) apply = false;

  const result = await db.$transaction(
    async (tx) => {
      let created = 0;
      let updated = 0;
      let brandsCreated = 0;
      const brandIds = new Map<string, string>();
      for (const r of rows) {
        const brandKey = `${r.categoryId}:${deviceSlug(r.brand)}`;
        let brandId = brandIds.get(brandKey);
        if (!brandId) {
          let brand = await tx.deviceBrand.findFirst({
            where: { categoryId: r.categoryId, OR: [{ slug: slugify(r.brand) }, { name: { equals: r.brand, mode: "insensitive" } }] },
            select: { id: true },
          });
          if (!brand) {
            brandsCreated++;
            if (apply) brand = await tx.deviceBrand.create({ data: { categoryId: r.categoryId, slug: slugify(r.brand), name: r.brand }, select: { id: true } });
          }
          // In a dry run a new brand has no id yet; its models all count as new.
          brandId = brand?.id ?? `new:${brandKey}`;
          brandIds.set(brandKey, brandId);
        }
        const meta = { releaseYear: r.releaseYear, frame: r.frame, popular: r.popular, aliases: r.aliases };
        const existing = brandId.startsWith("new:")
          ? null
          : await tx.deviceModel.findFirst({ where: { brandId, OR: [{ slug: deviceSlug(r.name) }, { name: { equals: r.name, mode: "insensitive" } }] }, select: { id: true } });
        if (existing) {
          updated++;
          if (apply) await tx.deviceModel.update({ where: { id: existing.id }, data: meta });
        } else {
          created++;
          if (apply) await tx.deviceModel.create({ data: { brandId, categoryId: r.categoryId, slug: deviceSlug(r.name), name: r.name, ...meta } });
        }
      }
      if (apply) await audit(tx, actor, { action: "catalog.import", entityType: "DeviceModel", entityId: "bulk", after: { created, updated, brandsCreated, rows: rows.length } });
      return { created, updated, brandsCreated };
    },
    { timeout: 120_000 },
  );
  return { ...result, errors, applied: apply };
}
