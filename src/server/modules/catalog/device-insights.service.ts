import "server-only";
import { db } from "@/server/db";
import { modelSeries } from "@/lib/device-series";
import { assertCan, type Actor } from "@/server/rbac/actor";

/** Every listed device model (not the "Other" placeholders) with what the insights page counts: photo, spec sheet, bookings. */
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
      brandId: true,
      brand: { select: { name: true, slug: true, active: true } },
      category: { select: { slug: true, nameEn: true } },
      specification: { select: { id: true } },
      _count: { select: { bookings: true } },
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
    bookings: m._count.bookings,
  }));
}

export type DeviceInsightRow = Awaited<ReturnType<typeof listDeviceInsights>>[number];
