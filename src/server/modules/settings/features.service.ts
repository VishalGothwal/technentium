import "server-only";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { FEATURE_KEYS, getFeatures } from "@/server/features";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { parseSetting, type SettingKey } from "@/server/settings";
import { supabaseAdminConfigured } from "@/server/supabase/admin";
import { supabaseConfigured } from "@/server/supabase/server";
import { env } from "@/server/env";
import { runtimeDatabaseUrl } from "@/server/db-url";

/** What the Feature controls page shows: current switches, captured test-mode codes and a setup check. */
export async function getFeatureControls(actor: Actor | null) {
  assertCan(actor, "system.features");
  const [features, testOtps] = await Promise.all([
    getFeatures(),
    db.testOtp.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const e = env();
  const checks = [
    {
      label: "Supabase project URL and publishable key",
      ok: supabaseConfigured(),
      hint: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    },
    {
      label: "Supabase secret key (admin controls, invites, switch user)",
      ok: supabaseAdminConfigured(),
      hint: "SUPABASE_SECRET_KEY — server only",
    },
    {
      label: "Send SMS hook secret (mobile number sign-in)",
      ok: !!e.SUPABASE_SMS_HOOK_SECRET,
      hint: "SUPABASE_SMS_HOOK_SECRET, from Authentication → Hooks → Send SMS",
    },
    {
      label: "SMS provider",
      ok: e.SMS_DRIVER === "fast2sms" || features.testMode,
      hint: e.SMS_DRIVER === "fast2sms" ? "Fast2SMS" : "SMS_DRIVER=console: codes are only printed to the server log",
    },
    {
      label: "Database on Supabase",
      ok: /supabase\.(co|com)/.test(runtimeDatabaseUrl() ?? ""),
      hint: "DATABASE_URL points at your Supabase Postgres (pooler, port 6543)",
    },
  ];
  return { features, testOtps, checks };
}

/** Change any `features.*` switches. Every change is validated and audited. */
export async function updateFeatures(actor: Actor | null, changes: Record<string, unknown>) {
  assertCan(actor, "system.features");
  const parsed: Partial<Record<SettingKey, unknown>> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (!(FEATURE_KEYS as string[]).includes(key))
      throw new AppError("VALIDATION", "errors.validation", {
        fields: { [key]: "validation.unknownSetting" },
      });
    try {
      parsed[key as SettingKey] = parseSetting(key as SettingKey, value);
    } catch {
      throw new AppError("VALIDATION", "errors.validation", {
        fields: { [key]: "validation.invalid" },
      });
    }
  }
  const rows = await db.businessSetting.findMany({
    where: { key: { in: Object.keys(parsed) } },
  });
  await db.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(parsed)) {
      await tx.businessSetting.upsert({
        where: { key },
        create: { key, value: value as never, updatedBy: actor.userId },
        update: { value: value as never, updatedBy: actor.userId },
      });
    }
    await audit(tx, actor, {
      action: "features.update",
      entityType: "BusinessSetting",
      entityId: Object.keys(parsed).join(","),
      before: Object.fromEntries(rows.map((r) => [r.key, r.value])),
      after: parsed,
    });
  });
}

export async function clearTestOtps(actor: Actor | null) {
  assertCan(actor, "system.features");
  await db.testOtp.deleteMany({});
}
