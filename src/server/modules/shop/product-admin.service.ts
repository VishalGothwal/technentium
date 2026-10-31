import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { Prisma as PrismaNS } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { parse } from "@/server/validation";
import { productCategorySchema, productSchema, productTypeSchema, stockAdjustSchema } from "@/lib/schemas/shop";
import { parseSpecs } from "./catalog.service";
import { stockLevel } from "./order-state";

/** Product, compatibility and stock administration (PRD §7.4, FR-PROD-09…11). */

const uniqueViolation = (err: unknown, field: string) => {
  if (err instanceof PrismaNS.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new AppError("VALIDATION", "errors.validation", { fields: { [field]: "shopErrors.duplicate" } });
  }
  throw err;
};

export type ProductAdminFilter = { q?: string; status?: "DRAFT" | "ACTIVE" | "ARCHIVED" | "ALL"; categoryId?: string; lowStock?: boolean; page?: number };

export async function listProductsAdmin(actor: Actor | null, filter: ProductAdminFilter = {}) {
  assertCan(actor, "product.manage", "inventory.manage");
  const pageSize = 25;
  const page = Math.max(1, filter.page ?? 1);
  const where: Prisma.ProductWhereInput = {
    ...(filter.status && filter.status !== "ALL" ? { status: filter.status } : { status: { not: "ARCHIVED" } }),
    ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    ...(filter.q
      ? { OR: [{ nameEn: { contains: filter.q, mode: "insensitive" } }, { sku: { contains: filter.q, mode: "insensitive" } }, { slug: { contains: filter.q, mode: "insensitive" } }] }
      : {}),
  };
  const select = {
    id: true,
    slug: true,
    sku: true,
    nameEn: true,
    status: true,
    pricePaise: true,
    mrpPaise: true,
    featured: true,
    universal: true,
    lowStockThreshold: true,
    updatedAt: true,
    category: { select: { nameEn: true, slug: true } },
    images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { mediaId: true } },
    inventory: { select: { onHand: true } },
    _count: { select: { compatibility: true } },
  };
  if (filter.lowStock) {
    // Low stock compares two columns, so filter in memory over the (small) catalogue.
    const all = await db.product.findMany({ where, orderBy: { nameEn: "asc" }, select });
    const low = all.filter((p) => (p.inventory?.onHand ?? 0) <= p.lowStockThreshold);
    return { items: low.slice((page - 1) * pageSize, page * pageSize).map(withStock), total: low.length, page, pageSize };
  }
  const [items, total] = await Promise.all([
    db.product.findMany({ where, orderBy: [{ updatedAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize, select }),
    db.product.count({ where }),
  ]);
  return { items: items.map(withStock), total, page, pageSize };
}

const withStock = <T extends { inventory: { onHand: number } | null; lowStockThreshold: number }>(p: T) => ({
  ...p,
  onHand: p.inventory?.onHand ?? 0,
  stock: stockLevel(p.inventory?.onHand ?? 0, p.lowStockThreshold),
});

export async function lowStockCount(actor: Actor | null) {
  assertCan(actor, "product.manage", "inventory.manage");
  const rows = await db.product.findMany({ where: { status: "ACTIVE" }, select: { lowStockThreshold: true, inventory: { select: { onHand: true } } } });
  return rows.filter((p) => (p.inventory?.onHand ?? 0) <= p.lowStockThreshold).length;
}

export async function getProductAdmin(actor: Actor | null, id: string) {
  assertCan(actor, "product.manage", "inventory.manage");
  const p = await db.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, nameEn: true } },
      images: { orderBy: { sortOrder: "asc" }, select: { mediaId: true } },
      compatibility: {
        orderBy: [{ deviceModel: { brand: { name: "asc" } } }, { deviceModel: { name: "asc" } }],
        select: { deviceModel: { select: { id: true, name: true, brand: { select: { name: true } }, category: { select: { nameEn: true } } } } },
      },
      inventory: true,
      movements: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!p) throw notFound("product");
  const actorIds = [...new Set(p.movements.map((m) => m.actorId))];
  const people = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  return { ...p, specs: parseSpecs(p.specs), onHand: p.inventory?.onHand ?? 0, names: Object.fromEntries(people.map((x) => [x.id, x.name])) as Record<string, string> };
}

async function validateRefs(input: { categoryId: string; typeId?: string | null; imageIds: string[]; compatibleModelIds: string[] }) {
  const [category, type, images, models] = await Promise.all([
    // A product type must belong to the product's category.
    input.typeId ? db.productType.findFirst({ where: { id: input.typeId, categoryId: input.categoryId }, select: { id: true } }) : Promise.resolve(true),
    db.productCategory.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
    db.mediaAsset.findMany({ where: { id: { in: input.imageIds }, purpose: "PRODUCT_IMAGE", isPublic: true }, select: { id: true } }),
    db.deviceModel.findMany({ where: { id: { in: input.compatibleModelIds } }, select: { id: true } }),
  ]);
  if (!category) throw new AppError("VALIDATION", "errors.validation", { fields: { categoryId: "validation.required" } });
  if (!type) throw new AppError("VALIDATION", "errors.validation", { fields: { typeId: "validation.required" } });
  if (images.length !== new Set(input.imageIds).size) throw new AppError("VALIDATION", "errors.validation", { fields: { imageIds: "shopErrors.images" } });
  if (models.length !== new Set(input.compatibleModelIds).size) throw new AppError("VALIDATION", "errors.validation", { fields: { compatibleModelIds: "shopErrors.device" } });
}

function productData(input: ReturnType<typeof productSchema.parse>) {
  return {
    slug: input.slug,
    sku: input.sku,
    nameEn: input.nameEn,
    nameHi: input.nameHi || null,
    summaryEn: input.summaryEn || null,
    summaryHi: input.summaryHi || null,
    descriptionEn: input.descriptionEn || null,
    descriptionHi: input.descriptionHi || null,
    categoryId: input.categoryId,
    typeId: input.typeId ?? null,
    pricePaise: input.pricePaise,
    mrpPaise: input.mrpPaise ?? null,
    status: input.status,
    featured: input.featured,
    universal: input.universal,
    lowStockThreshold: input.lowStockThreshold,
    specs: input.specs,
    seoTitle: input.seoTitle || null,
    metaDescription: input.metaDescription || null,
  };
}

export async function createProduct(actor: Actor | null, rawInput: unknown) {
  assertCan(actor, "product.manage");
  const input = parse(productSchema, rawInput);
  if (input.mrpPaise && input.mrpPaise < input.pricePaise) throw new AppError("VALIDATION", "errors.validation", { fields: { mrpPaise: "shopErrors.mrp" } });
  await validateRefs(input);
  try {
    return await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...productData(input),
          images: { create: input.imageIds.map((mediaId, sortOrder) => ({ mediaId, sortOrder })) },
          compatibility: { create: [...new Set(input.compatibleModelIds)].map((deviceModelId) => ({ deviceModelId })) },
          inventory: { create: { onHand: 0 } },
        },
        select: { id: true, slug: true },
      });
      await audit(tx, actor, { action: "product.create", entityType: "Product", entityId: product.id, after: { ...productData(input), images: input.imageIds.length, compat: input.compatibleModelIds.length } });
      return product;
    });
  } catch (err) {
    return uniqueViolation(err, String(err).includes("sku") ? "sku" : "slug");
  }
}

export async function updateProduct(actor: Actor | null, id: string, rawInput: unknown) {
  assertCan(actor, "product.manage");
  const input = parse(productSchema, rawInput);
  if (input.mrpPaise && input.mrpPaise < input.pricePaise) throw new AppError("VALIDATION", "errors.validation", { fields: { mrpPaise: "shopErrors.mrp" } });
  const before = await db.product.findUnique({ where: { id } });
  if (!before) throw notFound("product");
  await validateRefs(input);
  try {
    return await db.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: productData(input) });
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (input.imageIds.length) await tx.productImage.createMany({ data: input.imageIds.map((mediaId, sortOrder) => ({ productId: id, mediaId, sortOrder })) });
      await tx.productDeviceCompatibility.deleteMany({ where: { productId: id, deviceModelId: { notIn: input.compatibleModelIds } } });
      if (input.compatibleModelIds.length) {
        await tx.productDeviceCompatibility.createMany({ data: [...new Set(input.compatibleModelIds)].map((deviceModelId) => ({ productId: id, deviceModelId })), skipDuplicates: true });
      }
      await tx.inventoryBalance.upsert({ where: { productId: id }, create: { productId: id, onHand: 0 }, update: {} });
      await audit(tx, actor, {
        action: "product.update",
        entityType: "Product",
        entityId: id,
        before: { pricePaise: before.pricePaise, status: before.status, slug: before.slug },
        after: { pricePaise: input.pricePaise, status: input.status, slug: input.slug, images: input.imageIds.length, compat: input.compatibleModelIds.length },
      });
      return { id, slug: input.slug };
    });
  } catch (err) {
    return uniqueViolation(err, String(err).includes("sku") ? "sku" : "slug");
  }
}

/** FR-PROD-09/10: stock change with reason; the movement row keeps the actor and resulting balance. */
export async function adjustStock(actor: Actor | null, productId: string, rawInput: unknown) {
  assertCan(actor, "inventory.manage");
  const input = parse(stockAdjustSchema, rawInput);
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw notFound("product");
    await tx.inventoryBalance.upsert({ where: { productId }, create: { productId, onHand: 0 }, update: {} });
    const changed =
      input.delta < 0
        ? await tx.inventoryBalance.updateMany({ where: { productId, onHand: { gte: -input.delta } }, data: { onHand: { increment: input.delta } } })
        : await tx.inventoryBalance.updateMany({ where: { productId }, data: { onHand: { increment: input.delta } } });
    if (changed.count === 0) throw new AppError("CONFLICT", "shopErrors.negativeStock");
    const { onHand } = await tx.inventoryBalance.findUniqueOrThrow({ where: { productId }, select: { onHand: true } });
    await tx.inventoryMovement.create({ data: { productId, delta: input.delta, balance: onHand, reason: input.reason, note: input.note || null, actorId: actor.userId } });
    await audit(tx, actor, { action: "inventory.adjust", entityType: "Product", entityId: productId, after: { delta: input.delta, reason: input.reason, onHand } });
    return { onHand };
  });
}

// ───────────── Categories ─────────────

export async function listCategoriesAdmin(actor: Actor | null) {
  assertCan(actor, "product.manage", "inventory.manage");
  return db.productCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    include: { _count: { select: { products: true } }, types: { orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }], select: { id: true, nameEn: true, active: true } } },
  });
}

/** Create or edit a product type (HD+, Privacy, Anti-yellow…); its photo must be a public product image. */
export async function saveProductType(actor: Actor | null, id: string | null, rawInput: unknown) {
  assertCan(actor, "product.manage");
  const input = parse(productTypeSchema, rawInput);
  if (input.imageMediaId) {
    const img = await db.mediaAsset.findFirst({ where: { id: input.imageMediaId, purpose: "PRODUCT_IMAGE", isPublic: true }, select: { id: true } });
    if (!img) throw new AppError("VALIDATION", "errors.validation", { fields: { imageMediaId: "shopErrors.images" } });
  }
  const data = {
    ...input,
    nameHi: input.nameHi || null,
    descriptionEn: input.descriptionEn || null,
    descriptionHi: input.descriptionHi || null,
    imageMediaId: input.imageMediaId ?? null,
  };
  try {
    return await db.$transaction(async (tx) => {
      const row = id ? await tx.productType.update({ where: { id }, data }) : await tx.productType.create({ data });
      await audit(tx, actor, { action: id ? "product_type.update" : "product_type.create", entityType: "ProductType", entityId: row.id, after: data });
      return { id: row.id };
    });
  } catch (err) {
    if (err instanceof PrismaNS.PrismaClientKnownRequestError && err.code === "P2025") throw notFound("record");
    return uniqueViolation(err, "slug");
  }
}

export async function listProductTypesAdmin(actor: Actor | null) {
  assertCan(actor, "product.manage", "inventory.manage");
  return db.productType.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { nameEn: "asc" }],
    include: { category: { select: { nameEn: true, slug: true } }, _count: { select: { products: true } } },
  });
}

export async function saveCategory(actor: Actor | null, id: string | null, rawInput: unknown) {
  assertCan(actor, "product.manage");
  const input = parse(productCategorySchema, rawInput);
  const data = { ...input, nameHi: input.nameHi || null, descriptionEn: input.descriptionEn || null, descriptionHi: input.descriptionHi || null };
  try {
    return await db.$transaction(async (tx) => {
      const row = id ? await tx.productCategory.update({ where: { id }, data }) : await tx.productCategory.create({ data });
      await audit(tx, actor, { action: id ? "product_category.update" : "product_category.create", entityType: "ProductCategory", entityId: row.id, after: data });
      return { id: row.id };
    });
  } catch (err) {
    if (err instanceof PrismaNS.PrismaClientKnownRequestError && err.code === "P2025") throw notFound("record");
    return uniqueViolation(err, "slug");
  }
}
