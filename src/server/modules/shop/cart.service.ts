import "server-only";
import { assertSection } from "@/server/features";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { parse } from "@/server/validation";
import type { Actor } from "@/server/rbac/actor";
import { cartItemSchema, cartQuantitySchema, MAX_LINE_QUANTITY } from "@/lib/schemas/shop";
import { lineTotal, stockLevel } from "./order-state";

/**
 * Database-backed cart (FR-PROD-05). Signed-in customers own one cart by user id; guests own one by
 * an opaque token held in an httpOnly cookie (web) or the `X-Cart-Token` header (mobile apps).
 * The guest cart merges into the user cart on the first authenticated access.
 */

export const CART_COOKIE = "tn_cart";
export const CART_TOKEN_HEADER = "x-cart-token";
const MAX_LINES = 30;

export type CartIdentity = { actor: Actor | null; guestToken: string | null };

export const newGuestToken = () => randomBytes(24).toString("base64url");
const validToken = (t: string | null | undefined): t is string => !!t && /^[\w-]{20,64}$/.test(t);

const CART_ITEM_SELECT = {
  id: true,
  quantity: true,
  product: {
    select: {
      id: true,
      slug: true,
      sku: true,
      nameEn: true,
      nameHi: true,
      pricePaise: true,
      mrpPaise: true,
      status: true,
      lowStockThreshold: true,
      category: { select: { slug: true, active: true } },
      images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { mediaId: true } },
      inventory: { select: { onHand: true } },
    },
  },
  deviceModel: { select: { id: true, name: true, brand: { select: { name: true } } } },
} as const satisfies Prisma.CartItemSelect;

async function findCart(tx: Tx, identity: CartIdentity) {
  if (identity.actor) return tx.cart.findUnique({ where: { userId: identity.actor.userId }, select: { id: true } });
  if (validToken(identity.guestToken)) return tx.cart.findUnique({ where: { guestToken: identity.guestToken }, select: { id: true } });
  return null;
}

/** Move a guest cart's lines into the user's cart (quantities add up, capped) and delete the guest cart. */
export async function mergeGuestCart(userId: string, guestToken: string | null) {
  if (!validToken(guestToken)) return false;
  return db.$transaction(async (tx) => {
    const guest = await tx.cart.findUnique({ where: { guestToken }, include: { items: true } });
    if (!guest) return false;
    const target = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {}, include: { items: true } });
    for (const item of guest.items) {
      const existing = target.items.find((i) => i.productId === item.productId && i.deviceModelId === item.deviceModelId);
      if (existing) {
        await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: Math.min(MAX_LINE_QUANTITY, existing.quantity + item.quantity) } });
      } else {
        await tx.cartItem.create({ data: { cartId: target.id, productId: item.productId, deviceModelId: item.deviceModelId, quantity: item.quantity } });
      }
    }
    await tx.cart.delete({ where: { id: guest.id } });
    return true;
  });
}

/**
 * Current cart as a display DTO. When a signed-in customer still carries a guest token, the guest cart
 * is merged first; `mergedGuest` tells the caller to clear the cookie.
 */
export async function getCart(identity: CartIdentity) {
  let mergedGuest = false;
  if (identity.actor && identity.guestToken) mergedGuest = await mergeGuestCart(identity.actor.userId, identity.guestToken);
  const cart = await findCart(db, identity);
  const items = cart
    ? await db.cartItem.findMany({ where: { cartId: cart.id }, orderBy: { createdAt: "asc" }, select: CART_ITEM_SELECT })
    : [];
  return { ...toCartDto(items), mergedGuest };
}

type CartItemRow = Prisma.CartItemGetPayload<{ select: typeof CART_ITEM_SELECT }>;

function toCartDto(rows: CartItemRow[]) {
  const items = rows.map((r) => {
    const p = r.product;
    const stock = stockLevel(p.inventory?.onHand, p.lowStockThreshold);
    const available = p.status === "ACTIVE" && p.category.active && stock !== "out_of_stock";
    return {
      id: r.id,
      productId: p.id,
      slug: p.slug,
      sku: p.sku,
      nameEn: p.nameEn,
      nameHi: p.nameHi,
      categorySlug: p.category.slug,
      imageId: p.images[0]?.mediaId ?? null,
      unitPricePaise: p.pricePaise,
      mrpPaise: p.mrpPaise,
      quantity: r.quantity,
      lineTotalPaise: lineTotal(p.pricePaise, r.quantity),
      device: r.deviceModel ? { id: r.deviceModel.id, name: `${r.deviceModel.brand.name} ${r.deviceModel.name}` } : null,
      stock,
      available,
    };
  });
  const live = items.filter((i) => i.available);
  return {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotalPaise: live.reduce((n, i) => n + i.lineTotalPaise, 0),
    hasUnavailable: live.length !== items.length,
  };
}
export type CartDto = Awaited<ReturnType<typeof getCart>>;

/** Number of units in the cart, for the header badge. Never creates a cart. */
export async function cartCount(identity: CartIdentity) {
  const cart = await findCart(db, identity);
  if (!cart) return 0;
  const agg = await db.cartItem.aggregate({ where: { cartId: cart.id }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}

/**
 * Add a product (optionally for a specific device). Returns the cart and, for guests without a cart,
 * the newly issued token the caller must persist.
 */
export async function addToCart(identity: CartIdentity, rawInput: unknown) {
  await assertSection("shop");
  const input = parse(cartItemSchema, rawInput);
  const product = await db.product.findFirst({
    where: { id: input.productId, status: "ACTIVE", category: { active: true } },
    select: { id: true, universal: true, lowStockThreshold: true, inventory: { select: { onHand: true } } },
  });
  if (!product) throw notFound("product");
  if (stockLevel(product.inventory?.onHand, product.lowStockThreshold) === "out_of_stock") throw new AppError("CONFLICT", "shopErrors.outOfStock");
  const deviceModelId = input.deviceModelId ?? null;
  if (deviceModelId) {
    const model = await db.deviceModel.findFirst({ where: { id: deviceModelId, active: true }, select: { id: true } });
    if (!model) throw new AppError("VALIDATION", "errors.validation", { fields: { deviceModelId: "shopErrors.device" } });
    if (!product.universal) {
      const fits = await db.productDeviceCompatibility.findUnique({ where: { productId_deviceModelId: { productId: product.id, deviceModelId } } });
      if (!fits) throw new AppError("VALIDATION", "shopErrors.incompatible", { fields: { deviceModelId: "shopErrors.incompatible" } });
    }
  }

  let guestToken = identity.actor ? null : validToken(identity.guestToken) ? identity.guestToken : null;
  let issuedToken: string | null = null;
  await db.$transaction(async (tx) => {
    let cart = await findCart(tx, { actor: identity.actor, guestToken });
    if (!cart) {
      if (identity.actor) cart = await tx.cart.upsert({ where: { userId: identity.actor.userId }, create: { userId: identity.actor.userId }, update: {}, select: { id: true } });
      else {
        guestToken = issuedToken = newGuestToken();
        cart = await tx.cart.create({ data: { guestToken }, select: { id: true } });
      }
    }
    const lines = await tx.cartItem.findMany({ where: { cartId: cart.id }, select: { id: true, productId: true, deviceModelId: true, quantity: true } });
    const existing = lines.find((l) => l.productId === product.id && l.deviceModelId === deviceModelId);
    if (existing) {
      await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: Math.min(MAX_LINE_QUANTITY, existing.quantity + input.quantity) } });
    } else {
      if (lines.length >= MAX_LINES) throw new AppError("VALIDATION", "shopErrors.cartFull");
      await tx.cartItem.create({ data: { cartId: cart.id, productId: product.id, deviceModelId, quantity: input.quantity } });
    }
    await tx.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  });
  const cart = await getCart({ actor: identity.actor, guestToken });
  return { cart, issuedToken };
}

async function ownedItem(identity: CartIdentity, itemId: string) {
  const cart = await findCart(db, identity);
  const item = cart ? await db.cartItem.findFirst({ where: { id: itemId, cartId: cart.id }, select: { id: true } }) : null;
  if (!item) throw notFound("record");
  return item;
}

export async function updateCartItem(identity: CartIdentity, itemId: string, rawInput: unknown) {
  const { quantity } = parse(cartQuantitySchema, rawInput);
  await ownedItem(identity, itemId);
  await db.cartItem.update({ where: { id: itemId }, data: { quantity } });
  return getCart(identity);
}

export async function removeCartItem(identity: CartIdentity, itemId: string) {
  await ownedItem(identity, itemId);
  await db.cartItem.delete({ where: { id: itemId } });
  return getCart(identity);
}
