import "server-only";
import { db } from "@/server/db";
import { modelSeries } from "@/lib/device-series";
import { notFound } from "@/server/errors";
import { assertCan, type Actor } from "@/server/rbac/actor";

/**
 * The Devices hub: every listed device model (not the "Other" placeholders) with what each section of the site
 * has for it — photo, repair estimates and bookings, spec sheet, 3D model / custom designs, protection products.
 */
export async function listDeviceInsights(actor: Actor | null) {
  assertCan(actor, "catalog.manage");
  const rows = await db.deviceModel.findMany({
    where: { slug: { not: "other-model" }, brand: { slug: { not: "other" } } },
    orderBy: [{ category: { sortOrder: "asc" } }, { brand: { name: "asc" } }, { releaseYear: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      popular: true,
      releaseYear: true,
      imageMediaId: true,
      model3dId: true,
      brandId: true,
      brand: { select: { name: true, slug: true, active: true } },
      category: { select: { slug: true, nameEn: true } },
      specification: { select: { status: true } },
      _count: { select: { bookings: true, estimates: true, compatibleProducts: true, customizationRequests: true } },
    },
  });
  return rows.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    active: m.active,
    brandActive: m.brand.active,
    popular: m.popular,
    releaseYear: m.releaseYear,
    imageMediaId: m.imageMediaId,
    brandId: m.brandId,
    brandName: m.brand.name,
    brandSlug: m.brand.slug,
    categorySlug: m.category.slug,
    categoryName: m.category.nameEn,
    series: m.category.slug === "phone" ? (modelSeries(m.brand.slug, m.name)?.label ?? null) : null,
    hasSpec: !!m.specification,
    specStatus: m.specification?.status ?? null,
    has3d: !!m.model3dId,
    estimates: m._count.estimates,
    products: m._count.compatibleProducts,
    designs: m._count.customizationRequests,
    bookings: m._count.bookings,
  }));
}

export type DeviceInsightRow = Awaited<ReturnType<typeof listDeviceInsights>>[number];

/** Categories with their brands, for the add-device forms. */
export async function listCatalogOptions(actor: Actor | null) {
  assertCan(actor, "catalog.manage");
  return db.deviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    select: { id: true, slug: true, nameEn: true, brands: { where: { slug: { not: "other" } }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } } },
  });
}

/** One device with everything attached to it across repairs, specs, customization and protection. */
export async function getDeviceHub(actor: Actor | null, id: string) {
  assertCan(actor, "catalog.manage");
  const m = await db.deviceModel.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      popular: true,
      releaseYear: true,
      imageMediaId: true,
      frame: true,
      brandId: true,
      brand: { select: { name: true, slug: true, active: true } },
      category: { select: { id: true, slug: true, nameEn: true } },
      model3d: { select: { id: true, name: true, fileId: true } },
      specification: { select: { id: true, slug: true, status: true, imageMediaId: true } },
      bookings: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, reference: true, status: true, createdAt: true } },
      compatibleProducts: { orderBy: { product: { nameEn: "asc" } }, select: { product: { select: { id: true, nameEn: true, slug: true, status: true } } } },
      _count: { select: { bookings: true, customizationRequests: true } },
    },
  });
  if (!m) throw notFound("record");
  const [issues, estimates, universalProducts] = await Promise.all([
    db.repairIssueType.findMany({ where: { categoryId: m.category.id, active: true }, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }], select: { id: true, nameEn: true } }),
    db.repairEstimate.findMany({ where: { active: true, issueType: { categoryId: m.category.id }, OR: [{ modelId: m.id }, { modelId: null }] }, select: { issueTypeId: true, modelId: true, minPaise: true, maxPaise: true } }),
    db.product.count({ where: { universal: true, status: "ACTIVE" } }),
  ]);
  // Per issue: this model's own estimate if set, else the issue-wide default.
  const repairEstimates = issues.map((i) => {
    const own = estimates.find((e) => e.issueTypeId === i.id && e.modelId === m.id);
    const def = estimates.find((e) => e.issueTypeId === i.id && e.modelId === null);
    const e = own ?? def;
    return { issue: i.nameEn, minPaise: e?.minPaise ?? null, maxPaise: e?.maxPaise ?? null, source: own ? ("model" as const) : def ? ("default" as const) : null };
  });
  return {
    ...m,
    series: m.category.slug === "phone" ? (modelSeries(m.brand.slug, m.name)?.label ?? null) : null,
    repairEstimates,
    products: m.compatibleProducts.map((c) => c.product),
    universalProducts,
  };
}

export type DeviceHub = Awaited<ReturnType<typeof getDeviceHub>>;
