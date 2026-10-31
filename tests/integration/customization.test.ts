import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { Actor } from "@/server/rbac/actor";
import { authorizeMedia } from "@/server/modules/media/media.service";
import {
  addCustomizationNote,
  cancelMyCustomization,
  decideCustomizationQuote,
  getCustomizationForStaff,
  getMyCustomization,
  listCustomizationsForStaff,
  replyToCustomizationInfo,
  shareCustomizationQuote,
  submitCustomization,
  transitionCustomization,
} from "@/server/modules/customization/customization.service";
import { saveDesign } from "@/server/modules/customization/design-admin.service";
import { readConfig } from "@/lib/customization/config";
import { key, newCustomer, staff, tech } from "../support/fixtures";

/** A dedicated design + options per test so the suite does not depend on seed data. */
async function catalogue(opts: { designActive?: boolean } = {}) {
  const id = randomUUID().slice(0, 8);
  const [design, finish, coverage, model] = await Promise.all([
    db.design.create({
      data: { slug: `t-${id}`, nameEn: `Test ${id}`, collection: "minimal", style: { pattern: "waves", palette: ["#000000", "#ffffff"], density: 5, angle: 45 }, basePricePaise: 50000, active: opts.designActive ?? true },
    }),
    db.designOption.create({ data: { kind: "FINISH", slug: `f-${id}`, nameEn: "Metallic test", priceDeltaPaise: 15000 } }),
    db.designOption.create({ data: { kind: "COVERAGE", slug: `c-${id}`, nameEn: "Camera test", priceDeltaPaise: 9900 } }),
    db.deviceModel.findFirstOrThrow({ where: { slug: "iphone-13" } }),
  ]);
  return { design, finish, coverage, model };
}

async function input(overrides: Record<string, unknown> = {}) {
  const c = await catalogue();
  return {
    c,
    body: {
      deviceModelId: c.model.id,
      designId: c.design.id,
      finishOptionId: c.finish.id,
      coverageOptionId: c.coverage.id,
      palette: ["#112233", "#ffeedd"],
      text: { value: "ASHA", font: "serif", position: "bottom", color: "#ffffff" },
      notes: "Gift for my sister",
      acceptTerms: true,
      ...overrides,
    },
  };
}

const artworkFor = (actor: Actor) =>
  db.mediaAsset.create({ data: { storageKey: `test/${randomUUID()}.webp`, mime: "image/webp", sizeBytes: 100, purpose: "CUSTOM_ARTWORK", isPublic: false, uploadedById: actor.userId, draftKey: "pending" } });

const expectCode = async (p: Promise<unknown>, code: string) => expect(p).rejects.toMatchObject({ code });

describe("customization submission", () => {
  it("creates a request with a reference, a server-built snapshot and a notification", async () => {
    const customer = await newCustomer();
    const { c, body } = await input();
    const res = await submitCustomization(customer, { ...body, notes: "  hi  " }, key());
    expect(res.reference).toMatch(/^TN-C-\d{4}-\d{5}$/);

    const req = await db.customizationRequest.findUniqueOrThrow({ where: { reference: res.reference }, include: { history: true } });
    expect(req.status).toBe("SUBMITTED");
    expect(req.estimatePaise).toBe(50000 + 15000 + 9900);
    expect(req.history).toHaveLength(1);
    const config = readConfig(req.configuration)!;
    expect(config.device).toMatchObject({ id: c.model.id, kind: "phone" });
    expect(config.design?.nameEn).toBe(c.design.nameEn);
    expect(config.style.palette).toEqual(["#112233", "#ffeedd"]);
    expect(config.finish.deltaPaise).toBe(15000);
    expect(config.text?.value).toBe("ASHA");

    const event = await db.notificationEvent.findFirstOrThrow({ where: { recipientId: customer.userId, type: "custom.submitted" }, include: { deliveries: true } });
    expect(event.deliveries.map((d) => d.channel).sort()).toEqual(["email", "in_app"]);
  });

  it("is idempotent and keys are not reusable by another customer", async () => {
    const a = await newCustomer();
    const b = await newCustomer();
    const { body } = await input();
    const k = key();
    const first = await submitCustomization(a, body, k);
    expect(await submitCustomization(a, body, k)).toEqual({ reference: first.reference, duplicate: true });
    expect(await db.customizationRequest.count({ where: { customerId: a.userId } })).toBe(1);
    await expectCode(submitCustomization(b, body, k), "CONFLICT");
  });

  it("requires sign-in and accepted terms", async () => {
    const { body } = await input();
    await expectCode(submitCustomization(null, body, key()), "UNAUTHENTICATED");
    await expectCode(submitCustomization(await newCustomer(), { ...body, acceptTerms: false }, key()), "VALIDATION");
  });

  it("rejects archived designs, wrong option kinds and non-customizable devices", async () => {
    const customer = await newCustomer();
    const archived = await catalogue({ designActive: false });
    const { body } = await input();
    await expectCode(submitCustomization(customer, { ...body, designId: archived.design.id }, key()), "VALIDATION");
    await expectCode(submitCustomization(customer, { ...body, finishOptionId: body.coverageOptionId }, key()), "VALIDATION");
    const watch = await db.deviceModel.findFirst({ where: { category: { slug: { in: ["smartwatch", "audio"] } } } });
    if (watch) await expectCode(submitCustomization(customer, { ...body, deviceModelId: watch.id }, key()), "VALIDATION");
  });
});

describe("custom artwork (private uploads)", () => {
  it("only the uploader can attach or read draft artwork; staff can read it once submitted", async () => {
    const a = await newCustomer();
    const b = await newCustomer();
    const art = await artworkFor(a);
    const { body } = await input();
    const artwork = { mediaId: art.id, scale: 0.8, x: 0, y: 0.2 };

    await expectCode(submitCustomization(b, { ...body, artwork }, key()), "VALIDATION");
    await expectCode(authorizeMedia(b, art.id), "NOT_FOUND");
    await expectCode(authorizeMedia(null, art.id), "NOT_FOUND");
    await expect(authorizeMedia(a, art.id)).resolves.toMatchObject({ isPublic: false });

    const res = await submitCustomization(a, { ...body, artwork }, key());
    const linked = await db.mediaAsset.findUniqueOrThrow({ where: { id: art.id } });
    expect(linked.customizationRequestId).not.toBeNull();
    expect(linked.draftKey).toBeNull();
    await expect(authorizeMedia(await staff(), art.id)).resolves.toBeTruthy();
    await expectCode(authorizeMedia(b, art.id), "NOT_FOUND");

    // Already attached artwork can't be reused for a second request.
    await expectCode(submitCustomization(a, { ...body, artwork }, key()), "VALIDATION");
    expect((await getMyCustomization(a, res.reference)).artwork).toHaveLength(1);
  });
});

describe("customization lifecycle", () => {
  it("review → info → reply → price → accept → complete", async () => {
    const customer = await newCustomer();
    const s = await staff();
    const { reference } = await submitCustomization(customer, (await input()).body, key());
    const { id } = await db.customizationRequest.findUniqueOrThrow({ where: { reference } });

    await transitionCustomization(s, id, { to: "UNDER_REVIEW" });
    await expectCode(transitionCustomization(s, id, { to: "NEEDS_INFO", reason: "" }), "VALIDATION");
    await transitionCustomization(s, id, { to: "NEEDS_INFO", reason: "Please send a higher-resolution logo." });
    await replyToCustomizationInfo(customer, reference, { message: "Sent by email, thanks!" });
    expect((await getMyCustomization(customer, reference)).status).toBe("UNDER_REVIEW");

    // Price can't be set through the generic transition, only via the quote action.
    await expectCode(transitionCustomization(s, id, { to: "QUOTE_SHARED" }), "VALIDATION");
    await shareCustomizationQuote(s, id, { quotedPaise: 79900, message: "Includes fitting." });
    await expectCode(cancelMyCustomization(customer, reference), "INVALID_TRANSITION");

    await decideCustomizationQuote(customer, reference, { decision: "ACCEPT" });
    await expectCode(decideCustomizationQuote(customer, reference, { decision: "DECLINE" }), "QUOTE_NOT_ACTIONABLE");
    await transitionCustomization(s, id, { to: "COMPLETED" });

    const mine = await getMyCustomization(customer, reference);
    expect(mine.status).toBe("COMPLETED");
    expect(mine.quotedPaise).toBe(79900);
    expect(mine.history.map((h) => h.toStatus)).toEqual(["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO", "UNDER_REVIEW", "QUOTE_SHARED", "ACCEPTED", "COMPLETED"]);
    expect(mine.notes.some((n) => n.fromCustomer && n.body.includes("Sent by email"))).toBe(true);

    const types = (await db.notificationEvent.findMany({ where: { recipientId: customer.userId }, select: { type: true } })).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["custom.submitted", "custom.needs_info", "custom.quote_shared", "custom.completed"]));
    expect(await db.auditLog.count({ where: { entityType: "CustomizationRequest", entityId: id } })).toBeGreaterThanOrEqual(7);
  });

  it("customer can decline a shared price, and cancel before pricing", async () => {
    const customer = await newCustomer();
    const s = await staff();
    const one = await submitCustomization(customer, (await input()).body, key());
    const r1 = await db.customizationRequest.findUniqueOrThrow({ where: { reference: one.reference } });
    await transitionCustomization(s, r1.id, { to: "UNDER_REVIEW" });
    await shareCustomizationQuote(s, r1.id, { quotedPaise: 99900 });
    await shareCustomizationQuote(s, r1.id, { quotedPaise: 89900, message: "Revised" }); // revision
    await decideCustomizationQuote(customer, one.reference, { decision: "DECLINE", reason: "Too expensive" });
    expect((await getMyCustomization(customer, one.reference)).status).toBe("DECLINED");
    await expectCode(transitionCustomization(s, r1.id, { to: "UNDER_REVIEW" }), "INVALID_TRANSITION");

    const two = await submitCustomization(customer, (await input()).body, key());
    await cancelMyCustomization(customer, two.reference, { reason: "Changed my mind" });
    expect((await getMyCustomization(customer, two.reference)).status).toBe("CANCELLED");
  });
});

describe("customization permissions", () => {
  it("hides other customers' requests and blocks non-staff actions", async () => {
    const a = await newCustomer();
    const b = await newCustomer();
    const { reference } = await submitCustomization(a, (await input()).body, key());
    const { id } = await db.customizationRequest.findUniqueOrThrow({ where: { reference } });

    await expectCode(getMyCustomization(b, reference), "NOT_FOUND");
    await expectCode(cancelMyCustomization(b, reference), "NOT_FOUND");
    await expectCode(transitionCustomization(a, id, { to: "UNDER_REVIEW" }), "FORBIDDEN");
    await expectCode(listCustomizationsForStaff(a), "FORBIDDEN");
    await expectCode(getCustomizationForStaff(a, id), "FORBIDDEN");
  });

  it("technicians give internal technical input only", async () => {
    const customer = await newCustomer();
    const t = await tech();
    const { reference } = await submitCustomization(customer, (await input()).body, key());
    const { id } = await db.customizationRequest.findUniqueOrThrow({ where: { reference } });

    await addCustomizationNote(t, id, { body: "Camera cut-out needs 1mm margin", visibility: "INTERNAL" });
    await expectCode(addCustomizationNote(t, id, { body: "Hello customer", visibility: "CUSTOMER" }), "FORBIDDEN");
    await expectCode(transitionCustomization(t, id, { to: "UNDER_REVIEW" }), "FORBIDDEN");
    await expectCode(shareCustomizationQuote(t, id, { quotedPaise: 100 }), "FORBIDDEN");
    expect((await getMyCustomization(customer, reference)).notes).toHaveLength(0); // internal stays internal
  });

  it("design catalogue is managed by staff with customization.manage only", async () => {
    const id = randomUUID().slice(0, 8);
    const design = { slug: `adm-${id}`, nameEn: "Admin test", collection: "retro", style: { pattern: "dots", palette: ["#000000", "#ffffff"] }, basePricePaise: null };
    await expectCode(saveDesign(await tech(), null, design), "FORBIDDEN");
    const created = await saveDesign(await staff(), null, design);
    expect(created.id).toBeTruthy();
    await expectCode(saveDesign(await staff(), null, design), "VALIDATION"); // duplicate slug
  });
});
