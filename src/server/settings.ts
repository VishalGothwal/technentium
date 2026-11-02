import "server-only";
import { z } from "zod";
import { db, type Tx } from "@/server/db";

/**
 * Typed business settings (PRD: "avoid hardcoding serviceability, pricing, and warranty rules").
 * Each key has a schema and a default; the Owner edits them in Admin → Settings.
 */
export const SETTINGS = {
  "tax.gstRateBps": { schema: z.int().min(0).max(5000), default: 1800 },
  "quote.expiryDays": { schema: z.int().min(1).max(60), default: 7 },
  "quote.reminderDaysBeforeExpiry": { schema: z.int().min(0).max(30), default: 2 },
  "return.collectionChargePaise": { schema: z.int().min(0), default: 0 },
  "return.deliveryChargePaise": { schema: z.int().min(0), default: 9900 },
  "booking.defaultDiagnosisFeePaise": { schema: z.int().min(0), default: 19900 },
  "policy.version": { schema: z.string().min(1), default: "2026-10" },
  "warranty.defaultPolicyId": { schema: z.string().nullable(), default: null as string | null },
  "business.supportPhone": { schema: z.string(), default: "+91 00000 00000" },
  "business.shopAddress": { schema: z.string(), default: "Technentium, Jaipur, Rajasthan" },

  // Feature controls (Admin → Feature controls). Read through `server/features.ts`.
  "features.signUp": { schema: z.boolean(), default: true },
  "features.signIn.google": { schema: z.boolean(), default: true },
  "features.signIn.phoneOtp": { schema: z.boolean(), default: true },
  "features.signIn.emailPassword": { schema: z.boolean(), default: true },
  "features.section.repairs": { schema: z.boolean(), default: true },
  "features.section.shop": { schema: z.boolean(), default: true },
  "features.section.customization": { schema: z.boolean(), default: true },
  "features.section.content": { schema: z.boolean(), default: true },
  "features.testMode": { schema: z.boolean(), default: false },
  "features.maintenance": { schema: z.boolean(), default: false },
  "features.maintenanceMessage": { schema: z.string().max(300), default: "" },
  "features.impersonation": { schema: z.boolean(), default: true },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]["schema"]>;

export async function getSetting<K extends SettingKey>(key: K, tx: Tx | typeof db = db): Promise<SettingValue<K>> {
  const row = await tx.businessSetting.findUnique({ where: { key } });
  if (!row) return SETTINGS[key].default as SettingValue<K>;
  const parsed = SETTINGS[key].schema.safeParse(row.value);
  return (parsed.success ? parsed.data : SETTINGS[key].default) as SettingValue<K>;
}

export async function getAllSettings(): Promise<{ [K in SettingKey]: SettingValue<K> }> {
  const rows = await db.businessSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(SETTINGS)) {
    const parsed = def.schema.safeParse(byKey.get(key));
    out[key] = parsed.success ? parsed.data : def.default;
  }
  return out as { [K in SettingKey]: SettingValue<K> };
}

export function parseSetting<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  return SETTINGS[key].schema.parse(value) as SettingValue<K>;
}
