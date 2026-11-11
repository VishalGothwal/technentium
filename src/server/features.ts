import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { SETTINGS, type SettingKey } from "@/server/settings";

export const FEATURES_TAG = "features";

/** Owner-controlled switches, stored as `features.*` business settings. */
export type Features = {
  signUp: boolean;
  signIn: { google: boolean; phoneOtp: boolean; emailPassword: boolean };
  sections: {
    repairs: boolean;
    shop: boolean;
    customization: boolean;
    content: boolean;
  };
  testMode: boolean;
  maintenance: boolean;
  maintenanceMessage: string;
  impersonation: boolean;
  /** 3D (true) or 2D device previews, per section. */
  preview3d: { studio: boolean; repairs: boolean; specs: boolean };
};

export type Section = keyof Features["sections"];

export const FEATURE_KEYS = Object.keys(SETTINGS).filter((k) => k.startsWith("features.")) as SettingKey[];

async function readFeatures(): Promise<Features> {
  const rows = await db.businessSetting.findMany({
    where: { key: { in: FEATURE_KEYS } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const get = <K extends SettingKey>(key: K) => {
    const parsed = SETTINGS[key].schema.safeParse(byKey.get(key));
    return parsed.success ? parsed.data : SETTINGS[key].default;
  };
  return {
    signUp: get("features.signUp") as boolean,
    signIn: {
      google: get("features.signIn.google") as boolean,
      phoneOtp: get("features.signIn.phoneOtp") as boolean,
      emailPassword: get("features.signIn.emailPassword") as boolean,
    },
    sections: {
      repairs: get("features.section.repairs") as boolean,
      shop: get("features.section.shop") as boolean,
      customization: get("features.section.customization") as boolean,
      content: get("features.section.content") as boolean,
    },
    testMode: get("features.testMode") as boolean,
    maintenance: get("features.maintenance") as boolean,
    maintenanceMessage: get("features.maintenanceMessage") as string,
    impersonation: get("features.impersonation") as boolean,
    preview3d: {
      studio: get("features.preview3d.studio") as boolean,
      repairs: get("features.preview3d.repairs") as boolean,
      specs: get("features.preview3d.specs") as boolean,
    },
  };
}

/** Fresh read, memoised per request. Use wherever a switch is enforced (actions, API, sign-in). */
export const getFeatures = cache(readFeatures);

/**
 * Cached read for rendering (layouts and pages stay static). Admin changes call `updateTag(FEATURES_TAG)`;
 * other server instances pick changes up within a minute.
 */
export async function cachedFeatures(): Promise<Features> {
  "use cache";
  cacheTag(FEATURES_TAG);
  cacheLife("minutes");
  return readFeatures();
}

/** Refuse a customer-facing action while its site section is switched off. */
export async function assertSection(section: Section) {
  const features = await getFeatures();
  if (!features.sections[section]) throw new AppError("CONFLICT", "errors.featureOff");
}
