import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { loadActor } from "@/server/auth/session";
import type { Actor } from "@/server/rbac/actor";
import { PERMISSIONS, ROLE_DEFINITIONS, type RoleKey } from "@/server/rbac/permissions";
import { addToCart, getCart } from "@/server/modules/shop/cart.service";
import { adjustStock, createProduct } from "@/server/modules/shop/product-admin.service";
import {
  cancelMyProductRequest,
  completeProductRequest,
  confirmProductRequest,
  getMyProductRequest,
  listProductRequestsForStaff,
  shipProductRequest,
  startFulfilment,
  submitProductRequest,
} from "@/server/modules/shop/request.service";
import { key, newCustomer } from "../support/fixtures";

/**
 * The test database may predate the commerce roles, so sync role permissions from the code
 * (same as the seed) and create one staff user per role under test.
 */
async function syncRoles() {
  for (const k of PERMISSIONS) await db.permission.upsert({ where: { key: k }, create: { key: k }, update: {} });
  const perms = new Map((await db.permission.findMany()).map((p) => [p.key, p.id]));
  for (const roleKey of ["owner", "staff", "editor", "inventory"] as RoleKey[]) {
    const def = ROLE_DEFINITIONS[roleKey];
    const role = await db.role.upsert({ where: { key: roleKey }, create: { key: roleKey, name: def.name }, update: {} });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: def.permissions.map((p) => ({ roleId: role.id, permissionId: perms.get(p)! })) });
  }
}

async function staffWithRole(roleKey: RoleKey): Promise<Actor> {
  const id = randomUUID().slice(0, 8);
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  const user = await db.user.create({
    data: { email: `${roleKey}-${id}@example.test`, name: `${roleKey} ${id}`, emailVerified: true, staffProfile: { create: { displayName: roleKey } }, roles: { create: { roleId: role.id } } },
  });
  return (await loadActor(user.id))!;
}

let categoryId: string;
async function newProduct(opts: { pricePaise?: number; stock?: number | null; universal?: boolean; fits?: string[]; status?: "ACTIVE" | "DRAFT" } = {}) {
  const id = randomUUID().slice(0, 8);
  return db.product.create({
    data: {
      slug: `test-${id}`,
      sku: `T-${id}`,
      nameEn: `Test glass ${id}`,
      categoryId,
      pricePaise: opts.pricePaise ?? 49900,
      status: opts.status ?? "ACTIVE",
      universal: opts.universal ?? true,
      ...(opts.stock === null ? {} : { inventory: { create: { onHand: opts.stock ?? 10 } } }),
      compatibility: opts.fits ? { create: opts.fits.map((deviceModelId) => ({ deviceModelId })) } : undefined,
    },
  });
}

const address = { contactName: "Asha Test", contactPhone: "9876543210", addressLine1: "12 MG Road, Indiranagar", city: "Bengaluru", state: "Karnataka", pincode: "560038" };

/** Customer with one cart line, submitted as a request. */
async function submitted(customer: Actor, productId: string, quantity = 1) {
  await addToCart({ actor: customer, guestToken: null }, { productId, quantity });
  const { reference } = await submitProductRequest(customer, address, key());
  return db.productRequest.findUniqueOrThrow({ where: { reference }, include: { items: true } });
}

let manager: Actor;
let editor: Actor;
let inventory: Actor;

beforeAll(async () => {
  await syncRoles();
  const cat = await db.productCategory.upsert({ where: { slug: "test-protection" }, create: { slug: "test-protection", nameEn: "Test protection" }, update: { active: true } });
  categoryId = cat.id;
  manager = await staffWithRole("staff");
  editor = await staffWithRole("editor");
  inventory = await staffWithRole("inventory");
});

describe("cart", () => {
  it("merges a guest cart into the customer's cart on sign-in, adding quantities", async () => {
    const product = await newProduct();
    const other = await newProduct();
    const customer = await newCustomer();
    await addToCart({ actor: customer, guestToken: null }, { productId: product.id, quantity: 1 });

    const guest = await addToCart({ actor: null, guestToken: null }, { productId: product.id, quantity: 2 });
    expect(guest.issuedToken).toBeTruthy();
    await addToCart({ actor: null, guestToken: guest.issuedToken }, { productId: other.id, quantity: 1 });

    const merged = await getCart({ actor: customer, guestToken: guest.issuedToken });
    expect(merged.mergedGuest).toBe(true);
    expect(merged.items.find((i) => i.productId === product.id)?.quantity).toBe(3);
    expect(merged.items.find((i) => i.productId === other.id)?.quantity).toBe(1);
    expect(await db.cart.findUnique({ where: { guestToken: guest.issuedToken! } })).toBeNull();
  });

  it("rejects out-of-stock products and devices the product doesn't fit", async () => {
    const customer = await newCustomer();
    const empty = await newProduct({ stock: 0 });
    await expect(addToCart({ actor: customer, guestToken: null }, { productId: empty.id })).rejects.toMatchObject({ code: "CONFLICT" });

    const [fits, other] = await db.deviceModel.findMany({ take: 2, orderBy: { id: "asc" } });
    const mapped = await newProduct({ universal: false, fits: [fits.id] });
    await expect(addToCart({ actor: customer, guestToken: null }, { productId: mapped.id, deviceModelId: other.id })).rejects.toMatchObject({ code: "VALIDATION" });
    const ok = await addToCart({ actor: customer, guestToken: null }, { productId: mapped.id, deviceModelId: fits.id });
    expect(ok.cart.items[0].device?.id).toBe(fits.id);
  });

  it("hides draft products", async () => {
    const draft = await newProduct({ status: "DRAFT" });
    await expect(addToCart({ actor: await newCustomer(), guestToken: null }, { productId: draft.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("order request submission", () => {
  it("is idempotent, snapshots prices, empties the cart and notifies", async () => {
    const product = await newProduct({ pricePaise: 49900 });
    const customer = await newCustomer();
    await addToCart({ actor: customer, guestToken: null }, { productId: product.id, quantity: 2 });
    const k = key();
    const first = await submitProductRequest(customer, address, k);
    const second = await submitProductRequest(customer, address, k);
    expect(first.reference).toMatch(/^TN-P-\d{4}-\d{5}$/);
    expect(second).toEqual({ reference: first.reference, duplicate: true });
    expect(await db.productRequest.count({ where: { customerId: customer.userId } })).toBe(1);
    expect((await getCart({ actor: customer, guestToken: null })).items).toHaveLength(0);

    // Price change after submission does not touch the request (staff can't reprice).
    await db.product.update({ where: { id: product.id }, data: { pricePaise: 99900 } });
    const request = await getMyProductRequest(customer, first.reference);
    expect(request.items[0].unitPricePaise).toBe(49900);
    expect(request.subtotalPaise).toBe(99800);

    const event = await db.notificationEvent.findFirstOrThrow({ where: { recipientId: customer.userId, type: "order.submitted" } });
    expect(event.dedupeKey).toContain(request.id);
  });

  it("rejects an empty cart and unauthenticated callers", async () => {
    await expect(submitProductRequest(await newCustomer(), address, key())).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(submitProductRequest(null, address, key())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("staff processing and stock", () => {
  it("confirms with shipping, decrements stock on fulfilment, ships and completes", async () => {
    const product = await newProduct({ pricePaise: 50000, stock: 5 });
    const customer = await newCustomer();
    const req = await submitted(customer, product.id, 3);

    await confirmProductRequest(manager, req.id, { shippingPaise: 9900, items: [{ id: req.items[0].id, confirmedQuantity: 3 }] });
    const confirmed = await db.productRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(confirmed.totalPaise).toBe(3 * 50000 + 9900);

    await startFulfilment(manager, req.id);
    expect((await db.inventoryBalance.findUniqueOrThrow({ where: { productId: product.id } })).onHand).toBe(2);
    const movement = await db.inventoryMovement.findFirstOrThrow({ where: { productId: product.id, reason: "REQUEST_FULFILLED" } });
    expect(movement).toMatchObject({ delta: -3, balance: 2, requestId: req.id, actorId: manager.userId });

    await shipProductRequest(manager, req.id, { trackingInfo: "Blue Dart AWB 123" });
    await completeProductRequest(manager, req.id);
    const done = await getMyProductRequest(customer, req.reference);
    expect(done.status).toBe("COMPLETED");
    expect(done.trackingInfo).toBe("Blue Dart AWB 123");
    expect(done.history.map((h) => h.toStatus)).toEqual(["SUBMITTED", "CONFIRMED", "FULFILLING", "SHIPPED", "COMPLETED"]);
  });

  it("never lets stock go negative: fulfilment fails and nothing changes", async () => {
    const product = await newProduct({ stock: 3 });
    const req = await submitted(await newCustomer(), product.id, 3);
    await confirmProductRequest(manager, req.id, { shippingPaise: 0, items: [{ id: req.items[0].id, confirmedQuantity: 3 }] });
    await db.inventoryBalance.update({ where: { productId: product.id }, data: { onHand: 2 } }); // sold elsewhere meanwhile

    await expect(startFulfilment(manager, req.id)).rejects.toMatchObject({ code: "CONFLICT", messageKey: "shopErrors.insufficientStock" });
    expect((await db.inventoryBalance.findUniqueOrThrow({ where: { productId: product.id } })).onHand).toBe(2);
    expect((await db.productRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("CONFIRMED");
    expect(await db.inventoryMovement.count({ where: { requestId: req.id } })).toBe(0);
  });

  it("fulfils reduced confirmed quantities only", async () => {
    const product = await newProduct({ stock: 10 });
    const req = await submitted(await newCustomer(), product.id, 4);
    await expect(confirmProductRequest(manager, req.id, { shippingPaise: 0, items: [{ id: req.items[0].id, confirmedQuantity: 5 }] })).rejects.toMatchObject({ code: "VALIDATION" });
    await confirmProductRequest(manager, req.id, { shippingPaise: 0, items: [{ id: req.items[0].id, confirmedQuantity: 2 }] });
    await startFulfilment(manager, req.id);
    expect((await db.inventoryBalance.findUniqueOrThrow({ where: { productId: product.id } })).onHand).toBe(8);
  });

  it("enforces the state machine", async () => {
    const customer = await newCustomer();
    const req = await submitted(customer, (await newProduct()).id);
    await expect(completeProductRequest(manager, req.id)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await confirmProductRequest(manager, req.id, { shippingPaise: 0, items: [] });
    await expect(cancelMyProductRequest(customer, req.reference)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("lets the customer cancel before confirmation", async () => {
    const customer = await newCustomer();
    const req = await submitted(customer, (await newProduct()).id);
    await cancelMyProductRequest(customer, req.reference);
    expect((await getMyProductRequest(customer, req.reference)).status).toBe("CANCELLED");
  });

  it("adjusts stock with history and refuses negative balances", async () => {
    const product = await newProduct({ stock: 1 });
    expect(await adjustStock(inventory, product.id, { delta: 4, reason: "RECEIVED", note: "INV-1" })).toEqual({ onHand: 5 });
    await expect(adjustStock(inventory, product.id, { delta: -6, reason: "DAMAGED" })).rejects.toMatchObject({ code: "CONFLICT" });
    const movements = await db.inventoryMovement.findMany({ where: { productId: product.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ delta: 4, balance: 5, reason: "RECEIVED", actorId: inventory.userId });
  });
});

describe("authorisation", () => {
  it("returns NOT_FOUND for another customer's request (IDOR)", async () => {
    const owner = await newCustomer();
    const stranger = await newCustomer();
    const req = await submitted(owner, (await newProduct()).id);
    await expect(getMyProductRequest(stranger, req.reference)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(cancelMyProductRequest(stranger, req.reference)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getMyProductRequest(owner, req.reference)).status).toBe("SUBMITTED");
  });

  it("lets inventory managers process requests and stock, but not editors or customers", async () => {
    const req = await submitted(await newCustomer(), (await newProduct()).id);
    await expect(listProductRequestsForStaff(editor)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(confirmProductRequest(editor, req.id, { shippingPaise: 0, items: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(adjustStock(editor, req.items[0].productId, { delta: 1, reason: "RECEIVED" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createProduct(editor, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listProductRequestsForStaff(await newCustomer())).rejects.toMatchObject({ code: "FORBIDDEN" });

    const queue = await listProductRequestsForStaff(inventory, { status: "SUBMITTED", q: req.reference });
    expect(queue.items.map((i) => i.id)).toContain(req.id);
    await confirmProductRequest(inventory, req.id, { shippingPaise: 0, items: [] });
    // Operations staff can process requests but not change stock.
    await expect(adjustStock(manager, req.items[0].productId, { delta: 1, reason: "RECEIVED" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates product input and creates stock at zero", async () => {
    await expect(createProduct(inventory, { slug: "Bad Slug", sku: "", nameEn: "", categoryId, pricePaise: 0, status: "ACTIVE" })).rejects.toMatchObject({ code: "VALIDATION" });
    const id = randomUUID().slice(0, 8);
    const created = await createProduct(inventory, { slug: `new-${id}`, sku: `N-${id}`, nameEn: "New case", categoryId, pricePaise: 59900, mrpPaise: 99900, status: "DRAFT" });
    expect((await db.inventoryBalance.findUniqueOrThrow({ where: { productId: created.id } })).onHand).toBe(0);
    await expect(createProduct(inventory, { slug: `new-${id}`, sku: `M-${id}`, nameEn: "Dup", categoryId, pricePaise: 100, status: "DRAFT" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
