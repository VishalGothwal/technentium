import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";

/** Absolute site origin for canonical URLs, sitemaps and structured data. */
export const SITE_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = "Technentium";

export const absoluteUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

/**
 * Page metadata with canonical URL, en/hi alternates (hreflang), Open Graph and Twitter cards
 * (FR-CMS-11). `path` is the locale-less path, e.g. "/articles/how-to-save-battery".
 * Pass `availableLocales` when a translation is missing so hreflang never points at a 404.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  image,
  type = "website",
  publishedTime,
  modifiedTime,
  availableLocales = ["en", "hi"],
  noIndex,
}: {
  locale: Locale;
  path: string;
  title: string;
  description?: string | null;
  image?: string | null;
  type?: "website" | "article" | "video.other";
  publishedTime?: Date | null;
  modifiedTime?: Date | null;
  availableLocales?: readonly Locale[];
  noIndex?: boolean;
}): Metadata {
  const clean = path === "/" ? "" : path;
  const canonical = absoluteUrl(`/${locale}${clean}`);
  const languages: Record<string, string> = {};
  for (const l of availableLocales) languages[l === "hi" ? "hi-IN" : "en-IN"] = absoluteUrl(`/${l}${clean}`);
  if (availableLocales.includes("en")) languages["x-default"] = absoluteUrl(`/en${clean}`);
  const images = image ? [{ url: absoluteUrl(image) }] : undefined;
  return {
    title,
    description: description ?? undefined,
    alternates: { canonical, languages },
    openGraph: {
      type: type === "article" ? "article" : "website",
      url: canonical,
      title,
      description: description ?? undefined,
      siteName: SITE_NAME,
      locale: locale === "hi" ? "hi_IN" : "en_IN",
      images,
      ...(type === "article" ? { publishedTime: publishedTime?.toISOString(), modifiedTime: modifiedTime?.toISOString() } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description: description ?? undefined, images: image ? [absoluteUrl(image)] : undefined },
    robots: noIndex ? { index: false, follow: true } : undefined,
  };
}

/** JSON-LD helpers — render with <JsonLd data={...} />. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE_NAME,
    url: SITE_URL,
    address: { "@type": "PostalAddress", addressLocality: "Jaipur", addressRegion: "Rajasthan", addressCountry: "IN" },
    areaServed: "Jaipur",
  };
}
