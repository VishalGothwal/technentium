import type { Locale } from "@/i18n/config";

/** Public URL of an article or video. */
export const contentPath = (locale: Locale, type: "ARTICLE" | "VIDEO", slug: string) => `/${locale}/${type === "VIDEO" ? "videos" : "articles"}/${slug}`;
