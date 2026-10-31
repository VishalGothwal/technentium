import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { LOCALES, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/seo";
import { CONTENT_TOPICS } from "@/lib/schemas/content";
import { db } from "@/server/db";
import { CONTENT_TAG, SPECS_TAG } from "@/server/modules/content/content.public";
import { querySitemapContent } from "@/server/modules/content/content.queries";

type Entry = MetadataRoute.Sitemap[number];

/** One entry per locale, each listing its language alternates (hreflang) — FR-CMS-11. */
function localized(path: string, opts: { lastModified?: Date; locales?: readonly Locale[]; priority?: number; changeFrequency?: Entry["changeFrequency"] } = {}): Entry[] {
  const locales = opts.locales?.length ? opts.locales : LOCALES;
  const languages = Object.fromEntries(locales.map((l) => [l === "hi" ? "hi-IN" : "en-IN", absoluteUrl(`/${l}${path}`)]));
  return locales.map((l) => ({
    url: absoluteUrl(`/${l}${path}`),
    lastModified: opts.lastModified,
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    alternates: { languages },
  }));
}

const STATIC_PAGES: [path: string, priority: number, freq: Entry["changeFrequency"]][] = [
  ["", 1, "weekly"],
  ["/repairs", 0.9, "monthly"],
  ["/repairs/book", 0.9, "monthly"],
  ["/protection", 0.9, "weekly"],
  ["/protection/products", 0.8, "daily"],
  ["/customize", 0.8, "weekly"],
  ["/customize/studio", 0.7, "monthly"],
  ["/articles", 0.8, "daily"],
  ["/videos", 0.6, "weekly"],
  ["/specs", 0.7, "weekly"],
  ["/compare", 0.6, "weekly"],
  ["/guide", 0.6, "monthly"],
  ["/help", 0.5, "monthly"],
  ["/policies/privacy", 0.2, "yearly"],
  ["/policies/terms", 0.2, "yearly"],
  ["/policies/repair", 0.3, "yearly"],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheTag(CONTENT_TAG, SPECS_TAG, "products");
  cacheLife("hours");

  const [content, products, productCategories] = await Promise.all([
    querySitemapContent(),
    db.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } }),
    db.productCategory.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
  ]);

  return [
    ...STATIC_PAGES.flatMap(([path, priority, changeFrequency]) => localized(path, { priority, changeFrequency })),
    ...CONTENT_TOPICS.flatMap((tp) => localized(`/articles/topic/${tp}`, { priority: 0.5, changeFrequency: "weekly" })),
    ...content.items.flatMap((i) =>
      localized(`/${i.type === "VIDEO" ? "videos" : "articles"}/${i.slug}`, {
        // Only locales with a published translation (FR-CMS-04).
        locales: i.translations.map((t) => t.locale as Locale),
        lastModified: new Date(Math.max(...i.translations.map((t) => t.updatedAt.getTime()))),
        priority: 0.7,
        changeFrequency: "monthly",
      }),
    ),
    ...content.specs.flatMap((s) => localized(`/specs/${s.slug}`, { lastModified: s.updatedAt, priority: 0.6, changeFrequency: "monthly" })),
    ...content.comparisons.flatMap((c) => localized(`/compare/${c.slug}`, { lastModified: c.updatedAt, priority: 0.5, changeFrequency: "monthly" })),
    ...products.flatMap((p) => localized(`/protection/${p.slug}`, { lastModified: p.updatedAt, priority: 0.7, changeFrequency: "weekly" })),
    ...productCategories.flatMap((c) => localized(`/protection/products?category=${c.slug}`, { lastModified: c.updatedAt, priority: 0.5, changeFrequency: "weekly" })),
  ];
}
