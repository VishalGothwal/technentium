import "server-only";
import { assertSection } from "@/server/features";
import type { ProductRequestStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db, type Tx } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { dispatchAfterCommit, enqueue } from "@/server/notifications/outbox";
import { enforce } from "@/server/rate-limit";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { parse } from "@/server/validation";
import { formatPaise } from "@/lib/format";
import { confirmRequestSchema, productRequestSchema, reasonSchema, requestNoteSchema, shipSchema } from "@/lib/schemas/shop";
import { confirmedTotal, findOrderRule, stockLevel, subtotalOf } from "./order-state";

/**
 * Product order requests (PRD §6.6). A submitted request is not a paid or confirmed order
 * (FR-PROD-13): staff confirm availability and shipping, then fulfil. Prices are snapshotted at
 * submission and never changed afterwards; staff may only reduce confirmed quantities.
 */

function requireUser(actor: Actor | null): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
}

async function nextReference(tx: Tx): Promise<string> {
  const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('product_request_ref_seq')`;
  const yymm = new Date().toISOString().slice(2, 7).replace("-", "");
  return `TN-P-${yymm}-${String(nextval).padStart(5, "0")}`;
}

const orderHref = (reference: string) => `/account/orders/${reference}`;

// ───────────────────────────── Customer ─────────────────────────────

/** Submit the signed-in customer's cart as an order request. Idempotent on `idempotencyKey`. */
export async function submitProductRequest(actor: Actor | null, rawInput: unknown, idempotencyKey: string) {
  await assertSection("shop");
  requireUser(actor);
  if (!/^[\w-]{16,64}$/.test(idempotencyKey)) throw new AppError("VALIDATION", "errors.validation", { fields: { idempotencyKey: "validation.required" } });

  const existing = await db.productRequest.findUnique({ where: { idempotencyKey }, select: { reference: true, customerId: true } });
  if (existing) {
    if (existing.customerId !== actor.userId) throw new AppError("CONFLICT", "errors.conflict.idempotency");
    return { reference: existing.reference, duplicate: true };
  }

  await enforce(`order:${actor.userId}`, 3600, 10);
  const input = parse(productRequestSchema, rawInput);

  const cart = await db.cart.findUnique({
    where: { userId: actor.userId },
    select: {
      id: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          quantity: true,
          deviceModelId: true,
          product: { select: { id: true, nameEn: true, sku: true, pricePaise: true, status: true, lowStockThreshold: true, category: { select: { active: true } }, inventory: { select: { onHand: true } } } },
        },
      },
    },
  });
  if (!cart || cart.items.length === 0) throw new AppError("VALIDATION", "shopErrors.emptyCart");
  const unavailable = cart.items.some(
    (i) => i.product.status !== "ACTIVE" || !i.product.category.active || stockLevel(i.product.inventory?.onHand, i.product.lowStockThreshold) === "out_of_stock",
  );
  if (unavailable) throw new AppError("CONFLICT", "shopErrors.unavailableItems");

  const lines = cart.items.map((i) => ({
    productId: i.product.id,
    deviceModelId: i.deviceModelId,
    nameSnapshot: i.product.nameEn,
    skuSnapshot: i.product.sku,
    unitPricePaise: i.product.pricePaise,
    quantity: i.quantity,
  }));
  const subtotalPaise = subtotalOf(lines);

  try {
    const { reference, eventId } = await db.$transaction(async (tx) => {
      const reference = await nextReference(tx);
      const request = await tx.productRequest.create({
        data: {
          reference,
          idempotencyKey,
          customerId: actor.userId,
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 || null,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          customerNotes: input.notes || null,
          subtotalPaise,
          items: { create: lines },
          history: { create: { toStatus: "SUBMITTED", actorId: actor.userId, customerVisible: true } },
        },
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await audit(tx, actor, { action: "product_request.submit", entityType: "ProductRequest", entityId: request.id, after: { reference, subtotalPaise, lines: lines.length } });
      const eventId = await enqueue(tx, {
        type: "order.submitted",
        recipientId: actor.userId,
        dedupeKey: `order:${request.id}:submitted`,
        params: { reference },
        href: orderHref(reference),
      });
      return { reference, eventId };
    });
    dispatchAfterCommit([eventId]);
    return { reference, duplicate: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await db.productRequest.findUnique({ where: { idempotencyKey }, select: { reference: true, customerId: true } });
      if (winner && winner.customerId === actor.userId) return { reference: winner.reference, duplicate: true };
    }
    throw err;
  }
}

export async function listMyProductRequests(actor: Actor | null) {
  requireUser(actor);
  return db.productRequest.findMany({
    where: { customerId: actor.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      reference: true,
      status: true,
      createdAt: true,
      subtotalPaise: true,
      totalPaise: true,
      items: { select: { nameSnapshot: true, quantity: true, product: { select: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { mediaId: true } }, category: { select: { slug: true } } } } } },
    },
  });
}

/** IDOR-safe: another customer's reference is NOT_FOUND. */
export async function getMyProductRequest(actor: Actor | null, reference: string) {
  requireUser(actor);
  const request = await db.productRequest.findFirst({
    where: { reference, customerId: actor.userId },
    select: {
      id: true,
      reference: true,
      status: true,
      contactName: true,
      contactPhone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      pincode: true,
      customerNotes: true,
      subtotalPaise: true,
      shippingPaise: true,
      totalPaise: true,
      trackingInfo: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          id: true,
          nameSnapshot: true,
          skuSnapshot: true,
          unitPricePaise: true,
          quantity: true,
          confirmedQuantity: true,
          product: { select: { slug: true, nameHi: true, category: { select: { slug: true } }, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { mediaId: true } } } },
          deviceModel: { select: { name: true, brand: { select: { name: true } } } },
        },
      },
      history: { where: { customerVisible: true }, orderBy: { createdAt: "asc" }, select: { toStatus: true, reason: true, createdAt: true } },
      notes: { where: { visibility: "CUSTOMER" }, orderBy: { createdAt: "asc" }, select: { id: true, body: true, createdAt: true } },
    },
  });
  if (!request) throw notFound("request");
  return request;
}

export async function cancelMyProductRequest(actor: Actor | null, reference: string) {
  requireUser(actor);
  const request = await db.productRequest.findFirst({ where: { reference, customerId: actor.userId }, select: { id: true } });
  if (!request) throw notFound("request");
  return transition(actor, request.id, "CANCELLED", { by: "customer" });
}

// ───────────────────────────── Staff ─────────────────────────────

export type RequestQueueFilter = { status?: ProductRequestStatus | "OPEN" | "ALL"; q?: string; page?: number };

export async function listProductRequestsForStaff(actor: Actor | null, filter: RequestQueueFilter = {}) {
  assertCan(actor, "product_request.manage");
  const pageSize = 25;
  const page = Math.max(1, filter.page ?? 1);
  const where: Prisma.ProductRequestWhereInput = {
    ...(filter.status === "ALL"
      ? {}
      : filter.status === "OPEN" || !filter.status
        ? { status: { in: ["SUBMITTED", "CONFIRMED", "FULFILLING", "SHIPPED"] } }
        : { status: filter.status }),
    ...(filter.q
      ? {
          OR: [
            { reference: { contains: filter.q, mode: "insensitive" } },
            { contactName: { contains: filter.q, mode: "insensitive" } },
            { contactPhone: { contains: filter.q } },
            { pincode: { startsWith: filter.q } },
          ],
        }
      : {}),
  };
  const [items, total, counts] = await Promise.all([
    db.productRequest.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        reference: true,
        status: true,
        contactName: true,
        city: true,
        state: true,
        subtotalPaise: true,
        totalPaise: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    db.productRequest.count({ where }),
    db.productRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return { items, total, page, pageSize, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<ProductRequestStatus, number>> };
}

export async function getProductRequestForStaff(actor: Actor | null, id: string) {
  assertCan(actor, "product_request.manage");
  const request = await db.productRequest.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phoneNumber: true } },
      items: {
        include: {
          product: { select: { id: true, slug: true, status: true, inventory: { select: { onHand: true } } } },
          deviceModel: { select: { name: true, brand: { select: { name: true } } } },
        },
      },
      history: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) throw notFound("request");
  const actorIds = [...new Set([...request.history.map((h) => h.actorId), ...request.notes.map((n) => n.authorId)].filter((x): x is string => !!x))];
  const people = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  return { ...request, names: Object.fromEntries(people.map((p) => [p.id, p.name])) as Record<string, string> };
}

type TransitionOpts = {
  by: "staff" | "customer";
  reason?: string | null;
  /** Extra fields to write on the request in the same transaction. */
  data?: Prisma.ProductRequestUpdateInput;
  /** Extra work inside the transaction, before the status write (e.g. stock movements). */
  before?: (tx: Tx, request: { id: string; reference: string; customerId: string }) => Promise<void>;
  params?: Record<string, string>;
};

/**
 * The single place a request changes status: rule check, compare-and-set update, history, audit and
 * notification outbox in one transaction; notification delivery after commit.
 */
async function transition(actor: Actor, requestId: string, to: ProductRequestStatus, opts: TransitionOpts) {
  const eventId = await db.$transaction(async (tx) => {
    const request = await tx.productRequest.findUnique({ where: { id: requestId }, select: { id: true, reference: true, status: true, customerId: true } });
    if (!request) throw notFound("request");
    const rule = findOrderRule(request.status, to);
    if (!rule || !rule.by.includes(opts.by)) throw new AppError("INVALID_TRANSITION", "shopErrors.invalidTransition");
    if (rule.requiresReason && !opts.reason) throw new AppError("VALIDATION", "errors.validation", { fields: { reason: "validation.reason" } });

    await opts.before?.(tx, request);
    const updated = await tx.productRequest.updateMany({ where: { id: request.id, status: request.status }, data: { status: to } });
    if (updated.count === 0) throw new AppError("CONFLICT", "shopErrors.changed");
    if (opts.data) await tx.productRequest.update({ where: { id: request.id }, data: opts.data });
    await tx.productRequestStatusHistory.create({
      data: { requestId: request.id, fromStatus: request.status, toStatus: to, actorId: actor.userId, reason: opts.reason ?? null, customerVisible: true },
    });
    await audit(tx, actor, { action: `product_request.${to.toLowerCase()}`, entityType: "ProductRequest", entityId: request.id, before: { status: request.status }, after: { status: to, reason: opts.reason } });
    return enqueue(tx, {
      type: rule.notify,
      recipientId: request.customerId,
      dedupeKey: `order:${request.id}:${to}`,
      params: { reference: request.reference, reason: opts.reason ?? "", ...opts.params },
      href: orderHref(request.reference),
    });
  });
  dispatchAfterCommit([eventId]);
  return { status: to };
}

/** Confirm availability: per-line confirmed quantities (≤ requested), shipping and the resulting total. */
export async function confirmProductRequest(actor: Actor | null, requestId: string, rawInput: unknown) {
  assertCan(actor, "product_request.manage");
  const input = parse(confirmRequestSchema, rawInput);
  const request = await db.productRequest.findUnique({ where: { id: requestId }, select: { items: { select: { id: true, unitPricePaise: true, quantity: true } } } });
  if (!request) throw notFound("request");
  const confirmed = request.items.map((item) => {
    const line = input.items.find((l) => l.id === item.id);
    const confirmedQuantity = line ? line.confirmedQuantity : item.quantity;
    if (confirmedQuantity > item.quantity) throw new AppError("VALIDATION", "errors.validation", { fields: { [`items.${item.id}`]: "shopErrors.quantityAboveRequested" } });
    return { ...item, confirmedQuantity };
  });
  if (confirmed.every((c) => c.confirmedQuantity === 0)) throw new AppError("VALIDATION", "shopErrors.nothingConfirmed");
  const totalPaise = confirmedTotal(confirmed, input.shippingPaise);

  return transition(actor, requestId, "CONFIRMED", {
    by: "staff",
    reason: input.message || null,
    data: { shippingPaise: input.shippingPaise, totalPaise },
    before: async (tx) => {
      for (const c of confirmed) await tx.productRequestItem.update({ where: { id: c.id }, data: { confirmedQuantity: c.confirmedQuantity } });
    },
    params: { total: formatPaise(totalPaise) },
  });
}

export async function declineProductRequest(actor: Actor | null, requestId: string, rawInput: unknown) {
  assertCan(actor, "product_request.manage");
  const { reason } = parse(reasonSchema, rawInput);
  return transition(actor, requestId, "DECLINED", { by: "staff", reason });
}

export async function staffCancelProductRequest(actor: Actor | null, requestId: string, rawInput: unknown) {
  assertCan(actor, "product_request.manage");
  const { reason } = parse(reasonSchema, rawInput);
  return transition(actor, requestId, "CANCELLED", { by: "staff", reason });
}

/**
 * Start fulfilment: decrement stock for every confirmed line with a REQUEST_FULFILLED movement.
 * The conditional update (`onHand >= qty`) makes over-selling impossible even under concurrency;
 * if any line lacks stock the whole transaction rolls back.
 */
export async function startFulfilment(actor: Actor | null, requestId: string) {
  assertCan(actor, "product_request.manage");
  return transition(actor, requestId, "FULFILLING", {
    by: "staff",
    reason: null,
    before: async (tx, request) => {
      const items = await tx.productRequestItem.findMany({ where: { requestId: request.id }, select: { productId: true, quantity: true, confirmedQuantity: true, nameSnapshot: true } });
      for (const item of items) {
        const qty = item.confirmedQuantity ?? item.quantity;
        if (qty <= 0) continue;
        const balance = await tx.inventoryBalance.findUnique({ where: { productId: item.productId }, select: { onHand: true } });
        if (!balance) continue; // stock not tracked for this product
        const dec = await tx.inventoryBalance.updateMany({ where: { productId: item.productId, onHand: { gte: qty } }, data: { onHand: { decrement: qty } } });
        if (dec.count === 0) throw new AppError("CONFLICT", "shopErrors.insufficientStock", { product: item.nameSnapshot });
        const after = await tx.inventoryBalance.findUniqueOrThrow({ where: { productId: item.productId }, select: { onHand: true } });
        await tx.inventoryMovement.create({
          data: { productId: item.productId, delta: -qty, balance: after.onHand, reason: "REQUEST_FULFILLED", requestId: request.id, actorId: actor.userId, note: request.reference },
        });
      }
    },
    params: { reason: "" },
  });
}

export async function shipProductRequest(actor: Actor | null, requestId: string, rawInput: unknown) {
  assertCan(actor, "product_request.manage");
  const { trackingInfo } = parse(shipSchema, rawInput);
  return transition(actor, requestId, "SHIPPED", { by: "staff", reason: trackingInfo, data: { trackingInfo } });
}

export async function completeProductRequest(actor: Actor | null, requestId: string) {
  assertCan(actor, "product_request.manage");
  return transition(actor, requestId, "COMPLETED", { by: "staff" });
}

/** FR-PROD-08: record communication. Customer-visible notes notify the customer. */
export async function addProductRequestNote(actor: Actor | null, requestId: string, rawInput: unknown) {
  assertCan(actor, "product_request.manage");
  const input = parse(requestNoteSchema, rawInput);
  const eventId = await db.$transaction(async (tx) => {
    const request = await tx.productRequest.findUnique({ where: { id: requestId }, select: { id: true, reference: true, customerId: true } });
    if (!request) throw notFound("request");
    const note = await tx.productRequestNote.create({
      data: { requestId, authorId: actor.userId, body: input.body, visibility: input.customerVisible ? "CUSTOMER" : "INTERNAL" },
    });
    await audit(tx, actor, { action: "product_request.note", entityType: "ProductRequest", entityId: requestId, after: { noteId: note.id, customerVisible: input.customerVisible } });
    if (!input.customerVisible) return null;
    return enqueue(tx, {
      type: "order.updated",
      recipientId: request.customerId,
      dedupeKey: `order:${request.id}:note:${note.id}`,
      params: { reference: request.reference, reason: input.body.slice(0, 300) },
      href: orderHref(request.reference),
    });
  });
  dispatchAfterCommit([eventId]);
  return { ok: true };
}

/** Prefill for the checkout form: the customer's name/phone plus the address of their latest request. */
export async function checkoutDefaults(actor: Actor | null) {
  requireUser(actor);
  const [user, last] = await Promise.all([
    db.user.findUnique({ where: { id: actor.userId }, select: { name: true, phoneNumber: true } }),
    db.productRequest.findFirst({
      where: { customerId: actor.userId },
      orderBy: { createdAt: "desc" },
      select: { contactName: true, contactPhone: true, addressLine1: true, addressLine2: true, city: true, state: true, pincode: true },
    }),
  ]);
  const phone = (last?.contactPhone ?? user?.phoneNumber ?? "").replace(/^\+91/, "");
  return {
    contactName: last?.contactName ?? (user?.name && user.name !== "Customer" ? user.name : ""),
    contactPhone: phone,
    addressLine1: last?.addressLine1 ?? "",
    addressLine2: last?.addressLine2 ?? "",
    city: last?.city ?? "",
    state: last?.state ?? "",
    pincode: last?.pincode ?? "",
  };
}
