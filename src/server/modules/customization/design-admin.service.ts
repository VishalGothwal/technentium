import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { parse } from "@/server/validation";
import { readStyle } from "@/lib/customization/style";
import { designInputSchema, designOptionInputSchema, studioStepsInputSchema } from "@/lib/schemas/customization";
import { readHiddenSteps } from "@/lib/customization/steps";
import { getSetting } from "@/server/settings";

/** Design catalogue and finish/coverage options (Admin → Design catalogue), `customization.manage`. */

export async function listDesignsAdmin(actor: Actor | null) {
  assertCan(actor, "customization.manage");
  const rows = await db.design.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { nameEn: "asc" }], include: { _count: { select: { requests: true } } } });
  return rows.map((d) => ({ ...d, style: readStyle(d.style) }));
}

export async function getDesignAdmin(actor: Actor | null, id: string) {
  assertCan(actor, "customization.manage");
  const d = await db.design.findUnique({ where: { id } });
  if (!d) throw notFound("design");
  return { ...d, style: readStyle(d.style) };
}

const slugTaken = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** Create (id = null) or update a design. */
export async function saveDesign(actor: Actor | null, id: string | null, rawInput: unknown) {
  assertCan(actor, "customization.manage");
  const input = parse(designInputSchema, rawInput);
  const data = {
    ...input,
    nameHi: input.nameHi || null,
    descriptionEn: input.descriptionEn || null,
    descriptionHi: input.descriptionHi || null,
    style: input.style as Prisma.InputJsonValue,
  };
  try {
    return await db.$transaction(async (tx) => {
      const before = id ? await tx.design.findUnique({ where: { id } }) : null;
      if (id && !before) throw notFound("design");
      const row = id ? await tx.design.update({ where: { id }, data }) : await tx.design.create({ data });
      await audit(tx, actor, { action: id ? "design.update" : "design.create", entityType: "Design", entityId: row.id, before, after: data });
      return { id: row.id };
    });
  } catch (err) {
    if (slugTaken(err)) throw new AppError("VALIDATION", "errors.validation", { fields: { slug: "studio.validation.slugTaken" } });
    throw err;
  }
}

/** Archive rather than delete: past requests keep their design reference. */
export async function setDesignActive(actor: Actor | null, id: string, active: boolean) {
  assertCan(actor, "customization.manage");
  await db.$transaction(async (tx) => {
    const row = await tx.design.update({ where: { id }, data: { active } }).catch(() => null);
    if (!row) throw notFound("design");
    await audit(tx, actor, { action: active ? "design.activate" : "design.archive", entityType: "Design", entityId: id });
  });
  return { ok: true };
}

/** Studio steps hidden for every design. */
export async function getStudioStepsAdmin(actor: Actor | null) {
  assertCan(actor, "customization.manage");
  return readHiddenSteps(await getSetting("studio.hiddenSteps"));
}

export async function setStudioSteps(actor: Actor | null, rawInput: unknown) {
  assertCan(actor, "customization.manage");
  const { hiddenSteps } = parse(studioStepsInputSchema, rawInput);
  const value = [...new Set(hiddenSteps)];
  await db.$transaction(async (tx) => {
    const before = await tx.businessSetting.findUnique({ where: { key: "studio.hiddenSteps" } });
    await tx.businessSetting.upsert({
      where: { key: "studio.hiddenSteps" },
      create: { key: "studio.hiddenSteps", value, updatedBy: actor.userId },
      update: { value, updatedBy: actor.userId },
    });
    await audit(tx, actor, { action: "studio.steps.update", entityType: "BusinessSetting", entityId: "studio.hiddenSteps", before: before?.value ?? [], after: value });
  });
  return { hiddenSteps: value };
}

export async function listDesignOptionsAdmin(actor: Actor | null) {
  assertCan(actor, "customization.manage");
  return db.designOption.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { nameEn: "asc" }] });
}

export async function saveDesignOption(actor: Actor | null, id: string | null, rawInput: unknown) {
  assertCan(actor, "customization.manage");
  const input = parse(designOptionInputSchema, rawInput);
  const data = { ...input, nameHi: input.nameHi || null, descriptionEn: input.descriptionEn || null, descriptionHi: input.descriptionHi || null };
  try {
    return await db.$transaction(async (tx) => {
      const before = id ? await tx.designOption.findUnique({ where: { id } }) : null;
      if (id && !before) throw notFound("record");
      if (before && before.kind !== input.kind) throw new AppError("VALIDATION", "errors.validation", { fields: { kind: "validation.invalid" } });
      const row = id ? await tx.designOption.update({ where: { id }, data }) : await tx.designOption.create({ data });
      await audit(tx, actor, { action: id ? "design_option.update" : "design_option.create", entityType: "DesignOption", entityId: row.id, before, after: data });
      return { id: row.id };
    });
  } catch (err) {
    if (slugTaken(err)) throw new AppError("VALIDATION", "errors.validation", { fields: { slug: "studio.validation.slugTaken" } });
    throw err;
  }
}
