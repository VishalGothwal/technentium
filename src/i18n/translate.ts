import en from "./messages/en.json";
import hi from "./messages/hi.json";
import shopEn from "./messages/shop.en.json";
import shopHi from "./messages/shop.hi.json";
import studioEn from "./messages/studio.en.json";
import studioHi from "./messages/studio.hi.json";
import contentEn from "./messages/content.en.json";
import contentHi from "./messages/content.hi.json";
import siteEn from "./messages/site.en.json";
import siteHi from "./messages/site.hi.json";
import type { Locale } from "./config";

/**
 * Core messages plus one file per section (`shop.*`, `studio.*`, `content.*`), each holding its
 * own top-level namespaces so sections can be translated and reviewed independently.
 */
export type Messages = typeof en;
export const MESSAGES: Record<Locale, Messages> = {
  en: { ...en, ...siteEn, ...shopEn, ...studioEn, ...contentEn },
  hi: { ...(hi as Messages), ...siteHi, ...shopHi, ...studioHi, ...contentHi },
};

function lookup(messages: unknown, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === "string" ? node : undefined;
}

export type TFunction = (key: string, params?: Record<string, string | number>) => string;

/**
 * Translator with English fallback (D-12). A missing Hindi string falls back to English rather
 * than showing a raw key; a key missing everywhere renders the key so it is caught in review.
 */
export function createT(locale: Locale): TFunction {
  return (key, params) => {
    const template = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES.en, key) ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
  };
}

export function hasTranslation(locale: Locale, key: string) {
  return lookup(MESSAGES[locale], key) !== undefined;
}

/** Pick the right column of a bilingual DB record (nameEn / nameHi) with English fallback. */
export const localized = (locale: Locale, en: string, hiValue?: string | null) => (locale === "hi" && hiValue ? hiValue : en);
