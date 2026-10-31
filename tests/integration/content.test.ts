import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { loadActor } from "@/server/auth/session";
import type { Actor } from "@/server/rbac/actor";
import { createContent, getContentForEdit, restoreRevision, setPublishState, updateContent } from "@/server/modules/content/content.admin";
import { queryCompare, queryContentDetail, queryContentList, querySpecDetail, querySpecList, resolveTargets } from "@/server/modules/content/content.queries";
import { saveComparison, saveSpec, setSpecStatus } from "@/server/modules/content/specs.admin";
import { SPEC_TEMPLATE } from "@/lib/content/specs";
import { actorByEmail, newCustomer, owner, staff, tech } from "../support/fixtures";

const editor = () => actorByEmail("editor@technentium.test");
const uniq = () => randomUUID().slice(0, 8);
const body = [{ type: "paragraph" as const, text: "Useful **guidance** with a [link](/en/repairs)." }];
const article = (slug: string, overrides: Record<string, unknown> = {}) => ({
  slug,
  topic: "tips",
  tags: ["battery"],
  translation: { title: `Title ${slug}`, summary: "Summary", body },
  ...overrides,
});

/** A staff member whose only content permission is content.edit (writer without publishing rights). */
async function writerWithoutPublish(): Promise<Actor> {
  const id = uniq();
  const perm = await db.permission.findUniqueOrThrow({ where: { key: "content.edit" } });
  const role = await db.role.create({ data: { key: `writer-${id}`, name: `Writer ${id}`, permissions: { create: { permissionId: perm.id } } } });
  const user = await db.user.create({ data: { email: `writer-${id}@example.test`, name: `Writer ${id}`, emailVerified: true, staffProfile: { create: { displayName: "Writer" } }, roles: { create: { roleId: role.id } } } });
  return (await loadActor(user.id))!;
}

describe("content permissions (FR-CMS-09)", () => {
  it("editors create and publish; a writer with only content.edit can draft but not publish", async () => {
    const ed = await editor();
    const created = await createContent(ed, article(`perm-${uniq()}`));
    await expect(setPublishState(ed, created.id, { locale: "en", action: "publish" })).resolves.toMatchObject({ status: "PUBLISHED" });

    const writer = await writerWithoutPublish();
    const draft = await createContent(writer, article(`writer-${uniq()}`));
    await expect(updateContent(writer, draft.id, { translations: { en: { title: "Edited", summary: "S", body } } })).resolves.toEqual({ id: draft.id });
    await expect(setPublishState(writer, draft.id, { locale: "en", action: "publish" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setSpecStatus(writer, "any", { action: "publish" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("technicians, operations staff and customers cannot edit content", async () => {
    for (const actor of [await tech(), await staff(), await newCustomer()]) {
      await expect(createContent(actor, article(`nope-${uniq()}`))).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(createContent(null, article(`anon-${uniq()}`))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("records an audit entry for create and publish", async () => {
    const ed = await editor();
    const { id } = await createContent(ed, article(`audit-${uniq()}`));
    await setPublishState(ed, id, { locale: "en", action: "publish" });
    const actions = (await db.auditLog.findMany({ where: { entityId: id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["content.create", "content.publish"]));
  });
});

describe("slugs (FR-CMS-10)", () => {
  it("rejects duplicate slugs per type but allows the same slug for an article and a video", async () => {
    const ed = await editor();
    const slug = `dup-${uniq()}`;
    await createContent(ed, article(slug));
    await expect(createContent(ed, article(slug))).rejects.toMatchObject({ code: "CONFLICT", messageKey: "articles.errors.slugTaken" });
    await expect(createContent(ed, article(slug, { type: "VIDEO", videoUrl: "https://youtu.be/abcdefghijk" }))).resolves.toMatchObject({ type: "VIDEO" });

    const other = await createContent(ed, article(`other-${uniq()}`));
    await expect(updateContent(ed, other.id, { item: { slug } })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects invalid slugs and unsafe content", async () => {
    const ed = await editor();
    await expect(createContent(ed, article("Bad Slug!"))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createContent(ed, article(`html-${uniq()}`, { translation: { title: "x", summary: "y", body: [{ type: "paragraph", text: "<script>alert(1)</script>" }] } }))).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(createContent(ed, article(`js-${uniq()}`, { translation: { title: "x", summary: "y", body: [{ type: "paragraph", text: "[x](javascript:alert(1))" }] } }))).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});

describe("publication and visibility", () => {
  it("drafts and archived items never reach the public queries", async () => {
    const ed = await editor();
    const slug = `draft-${uniq()}`;
    const { id } = await createContent(ed, article(slug, { translation: { title: `Draft only ${slug}`, summary: "s", body } }));
    expect(await queryContentDetail("ARTICLE", slug, "en")).toBeNull();
    expect((await queryContentList("en", { type: "ARTICLE", q: slug, page: 1, pageSize: 12 })).total).toBe(0);
    expect(await resolveTargets([{ targetType: "CONTENT", targetId: id }], "en")).toEqual([]);

    await setPublishState(ed, id, { locale: "en", action: "publish" });
    expect(await queryContentDetail("ARTICLE", slug, "en")).not.toBeNull();
    expect((await queryContentList("en", { type: "ARTICLE", q: slug, page: 1, pageSize: 12 })).total).toBe(1);

    await setPublishState(ed, id, { locale: "en", action: "archive" });
    expect(await queryContentDetail("ARTICLE", slug, "en")).toBeNull();
  });

  it("publishes each language independently and falls back to English (FR-CMS-03/04)", async () => {
    const ed = await editor();
    const slug = `bilingual-${uniq()}`;
    const { id } = await createContent(ed, article(slug));
    await updateContent(ed, id, { translations: { hi: { title: "हिंदी शीर्षक", summary: "सारांश", body: [{ type: "paragraph", text: "हिंदी पाठ" }] } } });
    await setPublishState(ed, id, { locale: "en", action: "publish" });

    let hi = await queryContentDetail("ARTICLE", slug, "hi");
    expect(hi).toMatchObject({ shownLocale: "en", isFallback: true, availableLocales: ["en"] });

    await setPublishState(ed, id, { locale: "hi", action: "publish" });
    hi = await queryContentDetail("ARTICLE", slug, "hi");
    expect(hi).toMatchObject({ shownLocale: "hi", isFallback: false, title: "हिंदी शीर्षक" });
    expect(hi!.availableLocales.sort()).toEqual(["en", "hi"]);

    // Unpublishing English leaves the Hindi version live.
    await setPublishState(ed, id, { locale: "en", action: "unpublish" });
    expect(await queryContentDetail("ARTICLE", slug, "en")).toMatchObject({ shownLocale: "hi", isFallback: true });
  });

  it("scheduled items become visible once their time has passed — no cron needed (FR-CMS-05)", async () => {
    const ed = await editor();
    const slug = `scheduled-${uniq()}`;
    const { id } = await createContent(ed, article(slug));
    const at = new Date(Date.now() + 60 * 60_000);
    await setPublishState(ed, id, { locale: "en", action: "schedule", scheduledAt: at.toISOString() });
    expect(await queryContentDetail("ARTICLE", slug, "en")).toBeNull();
    // Same query, evaluated after the scheduled time.
    expect(await queryContentDetail("ARTICLE", slug, "en", new Date(at.getTime() + 1000))).not.toBeNull();
  });

  it("refuses to publish an empty translation", async () => {
    const ed = await editor();
    const { id } = await createContent(ed, article(`empty-${uniq()}`, { translation: { title: "Empty", summary: "s", body: [] } }));
    await expect(setPublishState(ed, id, { locale: "en", action: "publish" })).rejects.toMatchObject({ code: "VALIDATION", messageKey: "articles.errors.incomplete" });
  });

  it("detects concurrent edits and restores revisions", async () => {
    const ed = await editor();
    const { id } = await createContent(ed, article(`rev-${uniq()}`));
    const loaded = await getContentForEdit(ed, id);
    await updateContent(ed, id, { translations: { en: { title: "Second title", summary: "s", body } }, expectedUpdatedAt: loaded.updatedAt.toISOString() });
    await expect(updateContent(ed, id, { item: { featured: true }, expectedUpdatedAt: loaded.updatedAt.toISOString() })).rejects.toMatchObject({ code: "CONFLICT" });

    const after = await getContentForEdit(ed, id);
    const en = after.translations.find((t) => t.locale === "en")!;
    expect(en.title).toBe("Second title");
    const first = en.revisions.at(-1)!;
    await restoreRevision(ed, first.id);
    const restored = await getContentForEdit(ed, id);
    expect(restored.translations.find((t) => t.locale === "en")!.title).toMatch(/^Title /);
  });

  it("links related content only when the target is published", async () => {
    const ed = await editor();
    const a = await createContent(ed, article(`rel-a-${uniq()}`));
    const b = await createContent(ed, article(`rel-b-${uniq()}`));
    await updateContent(ed, a.id, { relations: [{ targetType: "CONTENT", targetId: b.id }] });
    await expect(updateContent(ed, a.id, { relations: [{ targetType: "CONTENT", targetId: a.id }] })).rejects.toMatchObject({ code: "VALIDATION" });
    await setPublishState(ed, a.id, { locale: "en", action: "publish" });
    expect((await queryContentDetail("ARTICLE", a.slug, "en"))!.explicitRelated).toEqual([]);
    await setPublishState(ed, b.id, { locale: "en", action: "publish" });
    expect((await queryContentDetail("ARTICLE", a.slug, "en"))!.explicitRelated.map((l) => l.href)).toEqual([`/en/articles/${b.slug}`]);
  });
});

describe("specifications and comparisons (FR-SPEC)", () => {
  it("stores unknown values as null, hides unpublished sheets and aligns comparisons", async () => {
    const ed = await editor();
    const o = await owner();
    const brand = await db.deviceBrand.findFirstOrThrow({ where: { category: { slug: "phone" } } });
    const make = async () => {
      const m = await db.deviceModel.create({ data: { name: `Test Phone ${uniq()}`, slug: `test-phone-${uniq()}`, brandId: brand.id, categoryId: brand.categoryId } });
      const specs = SPEC_TEMPLATE.map((g) => ({ ...g, items: g.items.map((it) => (it.key === "size" ? { ...it, value: "6.1-inch" } : it)) }));
      return saveSpec(ed, null, { deviceModelId: m.id, slug: `spec-${m.slug}`, specs });
    };
    const a = await make();
    const b = await make();

    expect(await querySpecDetail(a.slug)).toBeNull();
    await setSpecStatus(o, a.id, { action: "publish" });
    const pub = await querySpecDetail(a.slug);
    const display = pub!.specs.find((g) => g.group === "display")!;
    expect(display.items.find((i) => i.key === "size")!.value).toBe("6.1-inch");
    expect(display.items.find((i) => i.key === "refresh_rate")!.value).toBeNull();
    const listed = (await querySpecList({ q: "Test Phone" })).map((s) => s.slug);
    expect(listed).toContain(a.slug);
    expect(listed).not.toContain(b.slug);

    // Unpublished spec b is excluded from comparisons until published.
    expect((await queryCompare([a.slug, b.slug])).map((s) => s.slug)).toEqual([a.slug]);
    await setSpecStatus(o, b.id, { action: "publish" });
    expect((await queryCompare([b.slug, a.slug])).map((s) => s.slug)).toEqual([b.slug, a.slug]);

    await expect(saveComparison(ed, null, { slug: `cmp-${uniq()}`, titleEn: "A vs A", specIds: [a.id, a.id] })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveComparison(ed, null, { slug: `cmp-${uniq()}`, titleEn: "Too few", specIds: [a.id] })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveComparison(ed, null, { slug: `cmp-${uniq()}`, titleEn: "A vs B", specIds: [a.id, b.id] })).resolves.toHaveProperty("id");
  });
});
