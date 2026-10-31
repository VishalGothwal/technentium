import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { parse } from "@/server/validation";
import { productListQuerySchema } from "@/lib/schemas/shop";
import { stockLevel } from "./order-state";

/** Public catalogue reads (FR-PROD-01…04). Only ACTIVE products in active categories are visible. */

export const PRODUCT_CARD_SELECT = {
  id: true,
  slug: true,
  sku: true,
  nameEn: true,
  nameHi: true,
  summaryEn: true,
  summaryHi: true,
  pricePaise: true,
  mrpPaise: true,
  featured: true,
  universal: true,
  lowStockThreshold: true,
  category: { select: { slug: true, nameEn: true, nameHi: true } },
  type: { select: { slug: true, nameEn: true, nameHi: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { mediaId: true } },
  inventory: { select: { onHand: true } },
} as const satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_CARD_SELECT }>;

export function toCard(p: CardRow) {
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    nameEn: p.nameEn,
    nameHi: p.nameHi,
    summaryEn: p.summaryEn,
    summaryHi: p.summaryHi,
    pricePaise: p.pricePaise,
    mrpPaise: p.mrpPaise,
    featured: p.featured,
    universal: p.universal,
    category: p.category,
    type: p.type,
    imageId: p.images[0]?.mediaId ?? null,
    stock: stockLevel(p.inventory?.onHand, p.lowStockThreshold),
  };
}
export type ProductCard = ReturnType<typeof toCard>;

const visible = { status: "ACTIVE", category: { active: true } } as const satisfies Prisma.ProductWhereInput;

/** Products that fit a device model: explicitly mapped or universal. */
const fitsDevice = (deviceModelId: string): Prisma.ProductWhereInput => ({ OR: [{ universal: true }, { compatibility: { some: { deviceModelId } } }] });

export async function listProducts(rawQuery: unknown) {
  const q = parse(productListQuerySchema, rawQuery);
  const terms = (q.q ?? "").split(/\s+/).filter(Boolean).slice(0, 5);
  const where: Prisma.ProductWhereInput = {
    ...visible,
    ...(q.category ? { category: { slug: q.category, active: true } } : {}),
    ...(q.type ? { type: { slug: q.type, active: true, ...(q.category ? { category: { slug: q.category } } : {}) } } : {}),
    ...(q.inStock ? { inventory: { onHand: { gt: 0 } } } : {}),
    AND: [
      ...(q.deviceModelId ? [fitsDevice(q.deviceModelId)] : []),
      ...terms.map((t) => ({
        OR: [
          { nameEn: { contains: t, mode: "insensitive" as const } },
          { nameHi: { contains: t, mode: "insensitive" as const } },
          { sku: { contains: t, mode: "insensitive" as const } },
          { summaryEn: { contains: t, mode: "insensitive" as const } },
          { category: { nameEn: { contains: t, mode: "insensitive" as const } } },
          { type: { nameEn: { contains: t, mode: "insensitive" as const } } },
        ],
      })),
    ],
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    q.sort === "price_asc"
      ? [{ pricePaise: "asc" }, { nameEn: "asc" }]
      : q.sort === "price_desc"
        ? [{ pricePaise: "desc" }, { nameEn: "asc" }]
        : q.sort === "newest"
          ? [{ createdAt: "desc" }]
          : [{ featured: "desc" }, { createdAt: "desc" }];

  const [rows, total] = await Promise.all([
    db.product.findMany({ where, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: PRODUCT_CARD_SELECT }),
    db.product.count({ where }),
  ]);
  return { items: rows.map(toCard), total, page: q.page, pageSize: q.pageSize, pages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export async function listFeaturedProducts(limit = 8) {
  const rows = await db.product.findMany({ where: { ...visible, featured: true }, orderBy: { updatedAt: "desc" }, take: limit, select: PRODUCT_CARD_SELECT });
  return rows.map(toCard);
}

export function listProductCategories() {
  return db.productCategory.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    select: { id: true, slug: true, nameEn: true, nameHi: true, descriptionEn: true, descriptionHi: true, _count: { select: { products: { where: { status: "ACTIVE" } } } } },
  });
}

/** Glass/case traits scored 1–5 on a type (`ProductType.highlights`). */
export type TypeHighlights = Partial<Record<"clarity" | "privacy" | "antiGlare" | "toughness" | "protection" | "grip" | "slim" | "showsColour", number>>;

const typeHighlights = (v: unknown): TypeHighlights =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).filter(([, n]) => typeof n === "number" && n >= 1 && n <= 5))
    : {};

/**
 * Active product types (e.g. HD+, Privacy, Anti-yellow) with how many visible products each has.
 * Pass a category slug to get one category's types; types without products are left out.
 */
export async function listProductTypes(categorySlug?: string | null) {
  const rows = await db.productType.findMany({
    where: { active: true, category: { active: true, ...(categorySlug ? { slug: categorySlug } : {}) } },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { nameEn: "asc" }],
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameHi: true,
      descriptionEn: true,
      descriptionHi: true,
      highlights: true,
      imageMediaId: true,
      category: { select: { slug: true, nameEn: true, nameHi: true } },
      _count: { select: { products: { where: visible } } },
    },
  });
  return rows.filter((r) => r._count.products > 0).map(({ _count, highlights, ...r }) => ({ ...r, highlights: typeHighlights(highlights), count: _count.products }));
}
export type ProductTypeSummary = Awaited<ReturnType<typeof listProductTypes>>[number];

export async function getProductBySlug(slug: string) {
  const p = await db.product.findFirst({
    where: { slug, ...visible },
    select: {
      ...PRODUCT_CARD_SELECT,
      type: { select: { slug: true, nameEn: true, nameHi: true, descriptionEn: true, descriptionHi: true } },
      descriptionEn: true,
      descriptionHi: true,
      specs: true,
      seoTitle: true,
      metaDescription: true,
      updatedAt: true,
      categoryId: true,
      images: { orderBy: { sortOrder: "asc" }, select: { mediaId: true, media: { select: { altEn: true, altHi: true, width: true, height: true } } } },
      compatibility: {
        select: { note: true, deviceModel: { select: { id: true, name: true, brand: { select: { name: true } }, category: { select: { slug: true } } } } },
        orderBy: [{ deviceModel: { brand: { name: "asc" } } }, { deviceModel: { name: "asc" } }],
      },
    },
  });
  if (!p) throw notFound("product");

  // Group compatible models by brand for display (FR-PROD-03).
  const byBrand = new Map<string, { id: string; name: string; note: string | null }[]>();
  for (const c of p.compatibility) {
    const list = byBrand.get(c.deviceModel.brand.name) ?? [];
    list.push({ id: c.deviceModel.id, name: c.deviceModel.name, note: c.note });
    byBrand.set(c.deviceModel.brand.name, list);
  }

  return {
    ...toCard({ ...p, images: p.images.slice(0, 1) }),
    descriptionEn: p.descriptionEn,
    descriptionHi: p.descriptionHi,
    specs: parseSpecs(p.specs),
    seoTitle: p.seoTitle,
    metaDescription: p.metaDescription,
    updatedAt: p.updatedAt,
    categoryId: p.categoryId,
    typeInfo: p.type,
    onHand: p.inventory?.onHand ?? null,
    images: p.images.map((i) => ({ id: i.mediaId, altEn: i.media.altEn, altHi: i.media.altHi, width: i.media.width, height: i.media.height })),
    compatibleModelIds: p.compatibility.map((c) => c.deviceModel.id),
    compatibilityByBrand: [...byBrand.entries()].map(([brand, models]) => ({ brand, models })),
  };
}
export type ProductDetail = Awaited<ReturnType<typeof getProductBySlug>>;

export type ProductSpec = { labelEn: string; labelHi?: string; value: string };
export function parseSpecs(value: unknown): ProductSpec[] {
  if (!Array.isArray(value)) return [];
  return value.filter((s): s is ProductSpec => !!s && typeof s === "object" && typeof s.labelEn === "string" && typeof s.value === "string");
}

/** "Does it fit my device?" — universal products fit everything; others need an explicit mapping. */
export async function checkCompatibility(productId: string, deviceModelId: string) {
  const product = await db.product.findFirst({ where: { id: productId, ...visible }, select: { universal: true } });
  if (!product) throw notFound("product");
  if (product.universal) return { compatible: true, universal: true, note: null };
  const row = await db.productDeviceCompatibility.findUnique({ where: { productId_deviceModelId: { productId, deviceModelId } }, select: { note: true } });
  return { compatible: !!row, universal: false, note: row?.note ?? null };
}

/** Products for a device, grouped by category — used by the "shop for my device" API. */
export async function productsForDevice(deviceModelId: string, limit = 48) {
  const rows = await db.product.findMany({
    where: { ...visible, ...fitsDevice(deviceModelId) },
    orderBy: [{ featured: "desc" }, { nameEn: "asc" }],
    take: limit,
    select: PRODUCT_CARD_SELECT,
  });
  return rows.map(toCard);
}

/** Related products: same category first, then others that fit the same devices. */
export async function relatedProducts(product: { id: string; categoryId: string; compatibleModelIds: string[] }, limit = 4) {
  const sameCategory = await db.product.findMany({
    where: { ...visible, categoryId: product.categoryId, id: { not: product.id } },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: limit,
    select: PRODUCT_CARD_SELECT,
  });
  if (sameCategory.length >= limit || product.compatibleModelIds.length === 0) return sameCategory.map(toCard);
  const more = await db.product.findMany({
    where: {
      ...visible,
      id: { notIn: [product.id, ...sameCategory.map((p) => p.id)] },
      compatibility: { some: { deviceModelId: { in: product.compatibleModelIds.slice(0, 50) } } },
    },
    take: limit - sameCategory.length,
    select: PRODUCT_CARD_SELECT,
  });
  return [...sameCategory, ...more].map(toCard);
}
