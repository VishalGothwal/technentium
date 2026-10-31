export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "tn_locale";

export const isLocale = (v: string | undefined | null): v is Locale => !!v && (LOCALES as readonly string[]).includes(v);

export const LOCALE_LABELS: Record<Locale, string> = { en: "English", hi: "हिन्दी" };

/** Swap the locale prefix of a path, keeping the rest (language switch preserves context, PRD §5.1). */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split("/");
  if (isLocale(parts[1])) parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join("/") || `/${to}`;
}
