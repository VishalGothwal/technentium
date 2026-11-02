import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { User as AuthUser } from "@supabase/supabase-js";
import { appUserIdFor } from "@/server/auth/provision";
import { isDeliverableEmail } from "@/server/providers/email";
import { loadActor } from "@/server/auth/session";
import { isAppError } from "@/server/errors";
import { submitBooking } from "@/server/modules/repairs/booking.service";
import {
  getPreferences,
  listActivity,
  listNotifications,
  markNotificationsRead,
  referenceType,
  trackReference,
  unreadCount,
  updatePreferences,
  updateProfile,
} from "@/server/modules/account/account.service";
import { buildOpenApiDocument } from "@/server/openapi/document";
import type { Actor } from "@/server/rbac/actor";
import { bookingInput, key, newCustomer } from "../support/fixtures";

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
    return null;
  } catch (e) {
    if (isAppError(e)) return e.code;
    throw e;
  }
}

const rand = (n = 5) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");

async function orderFor(actor: Actor) {
  const product = await db.product.create({
    data: {
      slug: `test-product-${randomUUID().slice(0, 8)}`,
      sku: `T-${randomUUID().slice(0, 8)}`,
      nameEn: "Test tempered glass",
      pricePaise: 49900,
      status: "ACTIVE",
      category: { connectOrCreate: { where: { slug: "test-category" }, create: { slug: "test-category", nameEn: "Test category" } } },
    },
  });
  return db.productRequest.create({
    data: {
      reference: `TN-P-2610-${rand()}`,
      customerId: actor.userId,
      contactName: "Test",
      contactPhone: "+919876543210",
      addressLine1: "1 Test Road",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      subtotalPaise: 49900,
      items: { create: { productId: product.id, nameSnapshot: product.nameEn, skuSnapshot: product.sku, unitPricePaise: 49900, quantity: 1 } },
      history: { create: { toStatus: "SUBMITTED" } },
    },
  });
}

async function designRequestFor(actor: Actor) {
  const slug = `t-${randomUUID().slice(0, 8)}`;
  const [finish, coverage] = await Promise.all([
    db.designOption.create({ data: { kind: "FINISH", slug, nameEn: "Matte" } }),
    db.designOption.create({ data: { kind: "COVERAGE", slug, nameEn: "Back only" } }),
  ]);
  const model = await db.deviceModel.findFirstOrThrow({ where: { slug: "iphone-13" } });
  return db.customizationRequest.create({
    data: {
      reference: `TN-C-2610-${rand()}`,
      customerId: actor.userId,
      deviceModelId: model.id,
      finishOptionId: finish.id,
      coverageOptionId: coverage.id,
      configuration: { palette: ["#000"] },
      history: { create: [{ toStatus: "SUBMITTED" }, { fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW", reason: "Looking at it" }, { toStatus: "UNDER_REVIEW", reason: "internal", customerVisible: false }] },
      status: "UNDER_REVIEW",
    },
  });
}

/** A Supabase Auth user as returned by `auth.getUser()`, for the linking rules (no Supabase needed). */
function authUser(over: Partial<AuthUser> = {}): AuthUser {
  return {
    id: randomUUID(),
    aud: "authenticated",
    app_metadata: {},
    user_metadata: { full_name: "Linked Person" },
    created_at: new Date().toISOString(),
    ...over,
  } as AuthUser;
}

describe("Supabase account linking", () => {
  it("links an existing account by verified email, and keeps the link on later sign-ins", async () => {
    const customer = await newCustomer();
    const { email } = await db.user.findUniqueOrThrow({ where: { id: customer.userId } });
    const u = authUser({ email, email_confirmed_at: new Date().toISOString() });

    expect(await appUserIdFor(u.id, async () => u)).toBe(customer.userId);
    expect((await db.user.findUniqueOrThrow({ where: { id: customer.userId } })).authUserId).toBe(u.id);
    // Linked: no lookup of the Supabase user needed any more.
    expect(await appUserIdFor(u.id, async () => null)).toBe(customer.userId);
  });

  it("does not link by an unconfirmed email; creates a separate account instead", async () => {
    const customer = await newCustomer();
    const { email } = await db.user.findUniqueOrThrow({ where: { id: customer.userId } });
    const u = authUser({ email });

    const id = await appUserIdFor(u.id, async () => u);
    expect(id).not.toBe(customer.userId);
    const created = await db.user.findUniqueOrThrow({ where: { id: id! }, include: { customerProfile: true } });
    // The address belongs to the other account, so the new one gets a placeholder and no verified email.
    expect(created.email).not.toBe(email);
    expect(created.emailVerified).toBe(false);
    expect(created.customerProfile).not.toBeNull();
  });

  it("creates a phone account (E.164 +91) with a placeholder email, and links by verified phone next time", async () => {
    const digits = `9${rand(9)}`;
    const u = authUser({ phone: `91${digits}`, phone_confirmed_at: new Date().toISOString(), user_metadata: {} });
    const id = await appUserIdFor(u.id, async () => u);
    const created = await db.user.findUniqueOrThrow({ where: { id: id! } });
    expect(created.phoneNumber).toBe(`+91${digits}`);
    expect(created.phoneNumberVerified).toBe(true);
    expect(created.name).toBe("Customer");
    expect(isDeliverableEmail(created.email)).toBe(false);

    // A second Supabase identity with the same verified phone joins the existing (unlinked) account only.
    await db.user.update({ where: { id: id! }, data: { authUserId: null } });
    const again = authUser({ phone: `91${digits}`, phone_confirmed_at: new Date().toISOString() });
    expect(await appUserIdFor(again.id, async () => again)).toBe(id);
  });

  it("refuses new accounts while sign-ups are switched off, but still links existing ones", async () => {
    await db.businessSetting.upsert({ where: { key: "features.signUp" }, create: { key: "features.signUp", value: false }, update: { value: false } });
    try {
      const stranger = authUser({ email: `new-${randomUUID().slice(0, 8)}@example.test`, email_confirmed_at: new Date().toISOString() });
      expect(await appUserIdFor(stranger.id, async () => stranger)).toBeNull();

      const customer = await newCustomer();
      const { email } = await db.user.findUniqueOrThrow({ where: { id: customer.userId } });
      const known = authUser({ email, email_confirmed_at: new Date().toISOString() });
      expect(await appUserIdFor(known.id, async () => known)).toBe(customer.userId);
    } finally {
      await db.businessSetting.delete({ where: { key: "features.signUp" } });
    }
  });

  it("blocked accounts have no actor", async () => {
    const customer = await newCustomer();
    await db.user.update({ where: { id: customer.userId }, data: { blockedAt: new Date() } });
    expect(await loadActor(customer.userId)).toBeNull();
  });
});

describe("activity feed and tracking", () => {
  it("lists repairs, orders and design requests together, and tracks each by reference", async () => {
    const customer = await newCustomer();
    const { reference: repairRef } = await submitBooking(customer, await bookingInput(), key());
    const order = await orderFor(customer);
    const design = await designRequestFor(customer);

    const feed = await listActivity(customer, "en");
    expect(feed.map((i) => i.type).sort()).toEqual(["customization", "order", "repair"]);
    expect(feed.find((i) => i.type === "order")?.href).toBe(`/en/account/orders/${order.reference}`);
    expect(feed.find((i) => i.type === "order")?.statusLabel).toBe("Request received");

    const repair = await trackReference(customer, "en", repairRef.toLowerCase());
    expect(repair.type).toBe("repair");
    expect(repair.steps.find((s) => s.current)?.key).toBe("submitted");

    const o = await trackReference(customer, "hi", order.reference);
    expect(o.type).toBe("order");
    expect(o.statusLabel).toBe("अनुरोध प्राप्त");

    const c = await trackReference(customer, "en", design.reference);
    expect(c.type).toBe("customization");
    // Internal (not customer-visible) history entries never leak into the timeline.
    expect(c.timeline.map((x) => x.reason)).toEqual([null, "Looking at it"]);
  });

  it("returns NOT_FOUND for other customers' references and unknown formats (IDOR)", async () => {
    const [owner, other] = await Promise.all([newCustomer(), newCustomer()]);
    const { reference } = await submitBooking(owner, await bookingInput(), key());
    const order = await orderFor(owner);
    expect(await errorCode(trackReference(other, "en", reference))).toBe("NOT_FOUND");
    expect(await errorCode(trackReference(other, "en", order.reference))).toBe("NOT_FOUND");
    expect(await errorCode(trackReference(owner, "en", "not-a-reference"))).toBe("NOT_FOUND");
    expect(await errorCode(trackReference(null, "en", reference))).toBe("UNAUTHENTICATED");
    expect(referenceType("TN-P-2610-00001")).toBe("order");
    expect(referenceType("TN-C-2610-00001")).toBe("customization");
    expect(referenceType("TN-2610-00001")).toBe("repair");
  });
});

describe("profile, notifications and preferences", () => {
  it("validates profile updates", async () => {
    const customer = await newCustomer();
    expect(await errorCode(updateProfile(customer, {}))).toBe("VALIDATION");
    expect(await errorCode(updateProfile(customer, { name: "A" }))).toBe("VALIDATION");
    expect(await errorCode(updateProfile(customer, { preferredLocale: "fr" }))).toBe("VALIDATION");
    expect(await errorCode(updateProfile(customer, { email: "nope" }))).toBe("VALIDATION");
    await updateProfile(customer, { name: "  Riya Sharma ", preferredLocale: "hi" });
    const user = await db.user.findUniqueOrThrow({ where: { id: customer.userId } });
    expect(user.name).toBe("Riya Sharma");
    expect(user.preferredLocale).toBe("hi");
  });

  it("paginates notifications and only marks the caller's own as read", async () => {
    const [me, other] = await Promise.all([newCustomer(), newCustomer()]);
    const make = (userId: string, i: number) =>
      db.inAppNotification.create({
        data: { userId, eventId: `test-${randomUUID()}`, titleKey: "booking.submitted", bodyKey: "booking.submitted", params: { reference: `TN-2610-0000${i}` }, href: "/account/bookings", createdAt: new Date(Date.now() - i * 1000) },
      });
    const mine = await Promise.all([0, 1, 2].map((i) => make(me.userId, i)));
    const theirs = await make(other.userId, 0);

    const page1 = await listNotifications(me, "en", { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.items[0].title).toBe("Booking TN-2610-00000 received");
    expect(page1.items[0].href).toBe("/en/account/bookings");
    const page2 = await listNotifications(me, "en", { limit: 2, cursor: page1.nextCursor });
    expect(page2.items.map((i) => i.id)).toEqual([mine[2].id]);
    expect(page2.nextCursor).toBeNull();

    expect((await markNotificationsRead(me, { ids: [mine[0].id, theirs.id] })).marked).toBe(1);
    expect((await db.inAppNotification.findUniqueOrThrow({ where: { id: theirs.id } })).readAt).toBeNull();
    expect((await unreadCount(me)).unread).toBe(2);
    expect((await markNotificationsRead(me, { all: true })).marked).toBe(2);
    expect((await unreadCount(me)).unread).toBe(0);
    expect(await errorCode(markNotificationsRead(me, { ids: [] }))).toBe("VALIDATION");
  });

  it("toggles optional channels but never in-app", async () => {
    const me = await newCustomer();
    const prefs = await updatePreferences(me, { channels: [{ channel: "sms", enabled: false }] });
    expect(prefs.channels.find((c) => c.channel === "sms")?.enabled).toBe(false);
    expect((await getPreferences(me)).channels.find((c) => c.channel === "in_app")?.enabled).toBe(true);
    expect(await errorCode(updatePreferences(me, { channels: [{ channel: "in_app", enabled: false }] }))).toBe("VALIDATION");
  });
});

describe("OpenAPI document", () => {
  it("is valid JSON with unique operationIds and documents bearer auth", () => {
    const doc = JSON.parse(JSON.stringify(buildOpenApiDocument("https://example.test")));
    expect(doc.openapi).toBe("3.1.0");
    const ids = Object.values(doc.paths as Record<string, Record<string, { operationId: string }>>).flatMap((p) => Object.values(p).map((o) => o.operationId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(doc.paths["/api/v1/account/activity"].get.security).toEqual([{ bearerAuth: [] }, { cookieAuth: [] }]);
    expect(doc.paths["/api/v1/devices/search"].get.security).toEqual([]);
    expect(doc.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
  });
});
