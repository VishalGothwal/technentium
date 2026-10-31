import "server-only";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { assertCan, can, type Actor } from "@/server/rbac/actor";
import { getAllSettings, parseSetting, SETTINGS, type SettingKey } from "@/server/settings";
import { parse } from "@/server/validation";
import { isValidPincode } from "@/lib/phone";

/** Keys a holder of `settings.fees` (but not `settings.manage`) may change (D-06). */
const FEE_KEYS: readonly SettingKey[] = ["booking.defaultDiagnosisFeePaise", "return.collectionChargePaise", "return.deliveryChargePaise", "tax.gstRateBps"];

export async function readSettings(actor: Actor | null) {
  assertCan(actor, "settings.manage", "settings.fees");
  return getAllSettings();
}

export async function updateSettings(actor: Actor | null, changes: Record<string, unknown>) {
  assertCan(actor, "settings.manage", "settings.fees");
  const parsed: Partial<Record<SettingKey, unknown>> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (!(key in SETTINGS)) throw new AppError("VALIDATION", "errors.validation", { fields: { [key]: "validation.unknownSetting" } });
    const k = key as SettingKey;
    if (!can(actor, "settings.manage") && !FEE_KEYS.includes(k)) throw new AppError("FORBIDDEN", "errors.forbidden");
    try {
      parsed[k] = parseSetting(k, value);
    } catch {
      throw new AppError("VALIDATION", "errors.validation", { fields: { [key]: "validation.invalid" } });
    }
  }
  const before = await getAllSettings();
  await db.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(parsed)) {
      await tx.businessSetting.upsert({ where: { key }, create: { key, value: value as never, updatedBy: actor.userId }, update: { value: value as never, updatedBy: actor.userId } });
    }
    await audit(tx, actor, {
      action: "settings.update",
      entityType: "BusinessSetting",
      entityId: Object.keys(parsed).join(","),
      before: Object.fromEntries(Object.keys(parsed).map((k) => [k, before[k as SettingKey]])),
      after: parsed,
    });
  });
}

// ───────── Serviceable areas (D-09) ─────────

export async function listAreas(actor: Actor | null) {
  assertCan(actor, "settings.manage");
  return db.serviceableArea.findMany({ orderBy: { pincode: "asc" } });
}

const areaSchema = z.object({
  pincode: z.string().trim().refine(isValidPincode, "validation.pincode"),
  locality: z.string().trim().min(2, "validation.required").max(80),
  active: z.boolean().default(true),
});

export async function upsertArea(actor: Actor | null, raw: unknown) {
  assertCan(actor, "settings.manage");
  const input = parse(areaSchema, raw);
  await db.$transaction(async (tx) => {
    const row = await tx.serviceableArea.upsert({ where: { pincode: input.pincode }, create: input, update: input });
    await audit(tx, actor, { action: "settings.area", entityType: "ServiceableArea", entityId: row.id, after: input });
  });
}

// ───────── Appointment slots ─────────

const slotGenSchema = z.object({
  fromDate: z.iso.date(),
  days: z.int().min(1).max(60),
  windows: z.array(z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })).min(1),
  capacity: z.int().min(1).max(50),
  closedWeekdays: z.array(z.int().min(0).max(6)).default([0]), // Sunday closed by default
});

/** Create slots for a date range; existing slots (same date+start) keep their capacity. */
export async function generateSlots(actor: Actor | null, raw: unknown) {
  assertCan(actor, "settings.manage");
  const input = parse(slotGenSchema, raw);
  let created = 0;
  const start = new Date(`${input.fromDate}T00:00:00.000Z`);
  await db.$transaction(async (tx) => {
    for (let d = 0; d < input.days; d++) {
      const date = new Date(start.getTime() + d * 86_400_000);
      if (input.closedWeekdays.includes(date.getUTCDay())) continue;
      for (const w of input.windows) {
        const exists = await tx.appointmentSlot.findUnique({ where: { date_startTime: { date, startTime: w.start } } });
        if (exists) continue;
        await tx.appointmentSlot.create({ data: { date, startTime: w.start, endTime: w.end, capacity: input.capacity } });
        created++;
      }
    }
    await audit(tx, actor, { action: "settings.slots.generate", entityType: "AppointmentSlot", entityId: input.fromDate, after: { ...input, created } });
  });
  return { created };
}

export async function listSlots(actor: Actor | null, days = 21) {
  assertCan(actor, "settings.manage", "booking.reschedule");
  const today = new Date(new Date().toISOString().slice(0, 10));
  return db.appointmentSlot.findMany({
    where: { date: { gte: today, lt: new Date(today.getTime() + days * 86_400_000) } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { _count: { select: { bookings: { where: { status: "CONFIRMED" } } } } },
  });
}

export async function updateSlot(actor: Actor | null, slotId: string, data: { capacity?: number; active?: boolean }) {
  assertCan(actor, "settings.manage");
  const input = parse(z.object({ capacity: z.int().min(0).max(50).optional(), active: z.boolean().optional() }), data);
  await db.$transaction(async (tx) => {
    const before = await tx.appointmentSlot.findUnique({ where: { id: slotId } });
    if (!before) throw notFound("slot");
    await tx.appointmentSlot.update({ where: { id: slotId }, data: input });
    await audit(tx, actor, { action: "settings.slot", entityType: "AppointmentSlot", entityId: slotId, before: { capacity: before.capacity, active: before.active }, after: input });
  });
}

// ───────── Diagnosis fee rules (D-06) ─────────

export async function listFeeRules(actor: Actor | null) {
  assertCan(actor, "settings.manage", "settings.fees");
  return db.diagnosisFeeRule.findMany({
    orderBy: { createdAt: "asc" },
    include: { category: { select: { nameEn: true } }, model: { select: { name: true } }, issueType: { select: { nameEn: true } } },
  });
}

const feeRuleSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().nullish(),
  modelId: z.string().nullish(),
  issueTypeId: z.string().nullish(),
  feePaise: z.int().min(0).max(10_000_00),
  waivedIfApproved: z.boolean(),
  active: z.boolean().default(true),
});

export async function upsertFeeRule(actor: Actor | null, raw: unknown) {
  assertCan(actor, "settings.manage", "settings.fees");
  const { id, ...data } = parse(feeRuleSchema, raw);
  const clean = { ...data, categoryId: data.categoryId || null, modelId: data.modelId || null, issueTypeId: data.issueTypeId || null };
  await db.$transaction(async (tx) => {
    const row = id ? await tx.diagnosisFeeRule.update({ where: { id }, data: clean }) : await tx.diagnosisFeeRule.create({ data: clean });
    await audit(tx, actor, { action: "settings.fee_rule", entityType: "DiagnosisFeeRule", entityId: row.id, after: clean });
  });
}

// ───────── Warranty policies (D-16) ─────────

export async function listWarrantyPolicies(actor: Actor | null) {
  assertCan(actor, "settings.manage");
  return db.warrantyPolicy.findMany({ orderBy: { createdAt: "asc" } });
}

const warrantySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  days: z.int().min(0).max(730),
  termsEn: z.string().trim().min(5).max(4000),
  termsHi: z.string().trim().max(4000).optional().default(""),
  partGrade: z.string().trim().max(40).nullish(),
  active: z.boolean().default(true),
});

export async function upsertWarrantyPolicy(actor: Actor | null, raw: unknown) {
  assertCan(actor, "settings.manage");
  const { id, ...data } = parse(warrantySchema, raw);
  const clean = { ...data, termsHi: data.termsHi || null, partGrade: data.partGrade || null };
  await db.$transaction(async (tx) => {
    const row = id ? await tx.warrantyPolicy.update({ where: { id }, data: clean }) : await tx.warrantyPolicy.create({ data: clean });
    await audit(tx, actor, { action: "settings.warranty", entityType: "WarrantyPolicy", entityId: row.id, after: clean });
  });
}
