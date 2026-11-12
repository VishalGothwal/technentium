import "server-only";
import { MODEL3D_SELECT } from "@/lib/device-3d";
import { db } from "@/server/db";
import { previewDiagnosisFee } from "./catalog.service";
import { pickEstimate, type EstimateRow } from "@/lib/repair-estimates";

/** Public reads for the browsable repair pages: category → brand → model → services with estimated prices. */

const active = { active: true } as const;

/** Every active category with its brands (and model counts) and repair services — for the landing and category pages. */
export function listRepairCatalogue() {
  return db.deviceCategory.findMany({
    where: active,
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameHi: true,
      brands: {
        where: { ...active, models: { some: active } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, slug: true, name: true, _count: { select: { models: { where: active } } } },
      },
      issues: { where: active, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }], select: { id: true, slug: true, nameEn: true, nameHi: true } },
    },
  });
}

export async function getRepairCategory(slug: string) {
  const all = await listRepairCatalogue();
  return all.find((c) => c.slug === slug) ?? null;
}

/** A brand's models (newest first) plus its sibling brands and the category's popular models. */
export async function getRepairBrand(categorySlug: string, brandSlug: string) {
  const category = await getRepairCategory(categorySlug);
  const brand = category?.brands.find((b) => b.slug === brandSlug);
  if (!category || !brand) return null;
  const [models, popular] = await Promise.all([
    db.deviceModel.findMany({
      where: { brandId: brand.id, ...active },
      orderBy: [{ releaseYear: { sort: "desc", nulls: "last" } }, { name: "asc" }],
      select: { id: true, slug: true, name: true, imageMediaId: true },
    }),
    db.deviceModel.findMany({
      where: { categoryId: category.id, popular: true, ...active, brand: active },
      orderBy: [{ releaseYear: { sort: "desc", nulls: "last" } }, { name: "asc" }],
      take: 12,
      select: { id: true, slug: true, name: true, imageMediaId: true, brand: { select: { slug: true, name: true } } },
    }),
  ]);
  return { category, brand, models, popular };
}

/** A model with every repair service for its category, each carrying its estimate (model override or issue default). */
export async function getRepairModel(categorySlug: string, brandSlug: string, modelSlug: string) {
  const model = await db.deviceModel.findFirst({
    where: { slug: modelSlug, ...active, brand: { slug: brandSlug, ...active }, category: { slug: categorySlug, ...active } },
    select: {
      id: true,
      slug: true,
      name: true,
      frame: true,
      imageMediaId: true,
      model3d: MODEL3D_SELECT,
      releaseYear: true,
      brand: { select: { id: true, slug: true, name: true } },
      category: {
        select: {
          id: true,
          slug: true,
          nameEn: true,
          nameHi: true,
          issues: {
            where: active,
            orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
            select: { id: true, slug: true, nameEn: true, nameHi: true, descriptionEn: true, descriptionHi: true },
          },
        },
      },
    },
  });
  if (!model) return null;
  const issueIds = model.category.issues.map((i) => i.id);
  const [rows, fee] = await Promise.all([
    db.repairEstimate.findMany({
      where: { ...active, issueTypeId: { in: issueIds }, OR: [{ modelId: null }, { modelId: model.id }] },
      select: { issueTypeId: true, modelId: true, minPaise: true, maxPaise: true },
    }),
    previewDiagnosisFee(model.id, []),
  ]);
  const services = model.category.issues.map((i) => ({ ...i, estimate: pickEstimate(rows as EstimateRow[], i.id, model.id) }));
  return { model, services, fee };
}
