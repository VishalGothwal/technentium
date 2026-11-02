import "server-only";
import { db } from "@/server/db";
import { getFeatures } from "@/server/features";
import { getSetting } from "@/server/settings";
import { LOCALES, type Locale } from "@/i18n/config";
import { localized } from "@/i18n/translate";
import { mediaUrl } from "@/lib/media";

/** Static configuration a mobile app fetches on launch. */
export async function appConfig() {
  const [supportPhone, shopAddress, policyVersion, features] = await Promise.all([
    getSetting("business.supportPhone"),
    getSetting("business.shopAddress"),
    getSetting("policy.version"),
    getFeatures(),
  ]);
  return {
    locales: LOCALES,
    defaultLocale: "en",
    currency: "INR",
    sections: {
      repairs: features.sections.repairs,
      protection: features.sections.shop,
      customization: features.sections.customization,
      articles: features.sections.content,
      specs: features.sections.content,
    },
    maintenance: features.maintenance ? { message: features.maintenanceMessage || null } : null,
    support: { phone: supportPhone, shopAddress },
    policyVersion,
    minSupportedAppVersion: process.env.MOBILE_MIN_APP_VERSION ?? "1.0.0",
    features: {
      phoneOtpLogin: features.signIn.phoneOtp,
      emailPasswordLogin: features.signIn.emailPassword,
      googleLogin: features.signIn.google,
      signUp: features.signUp,
      onlinePayments: false, // payments are deferred (PRD §2.2): orders and repairs are requests confirmed by staff
      repairServiceArea: "Jaipur",
      productShipping: "pan-India",
    },
    // Sign in with the Supabase SDK, then send `Authorization: Bearer <access_token>` to /api/v1.
    auth: { provider: "supabase", supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null, publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null, bearerHeader: "Authorization" },
  };
}

/** Published in this locale now: PUBLISHED, or SCHEDULED whose time has come (no cron needed). */
export const publishedTranslationWhere = (locale: Locale, now = new Date()) => ({
  locale,
  OR: [
    { status: "PUBLISHED" as const, OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
    { status: "SCHEDULED" as const, scheduledAt: { lte: now } },
  ],
});

/** Aggregated mobile home feed: devices, featured protection products and designs, latest articles. */
export async function homeFeed(locale: Locale) {
  const [categories, popularDevices, products, designs, articles] = await Promise.all([
    db.deviceCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }], select: { id: true, slug: true, nameEn: true, nameHi: true } }),
    db.deviceModel.findMany({
      where: { active: true, popular: true, brand: { active: true }, category: { active: true } },
      orderBy: [{ releaseYear: { sort: "desc", nulls: "last" } }, { name: "asc" }],
      take: 12,
      select: { id: true, slug: true, name: true, brand: { select: { name: true } }, category: { select: { slug: true } } },
    }),
    db.product.findMany({
      where: { status: "ACTIVE", featured: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        slug: true,
        nameEn: true,
        nameHi: true,
        pricePaise: true,
        mrpPaise: true,
        category: { select: { slug: true, nameEn: true, nameHi: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { mediaId: true } },
        inventory: { select: { onHand: true } },
      },
    }),
    db.design.findMany({
      where: { active: true, featured: true },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
      take: 8,
      select: { id: true, slug: true, nameEn: true, nameHi: true, collection: true, style: true, previewMediaId: true, basePricePaise: true },
    }),
    db.contentTranslation.findMany({
      where: publishedTranslationWhere(locale),
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
      take: 6,
      select: {
        title: true,
        summary: true,
        readingMinutes: true,
        publishedAt: true,
        scheduledAt: true,
        contentItem: { select: { type: true, slug: true, topic: true, coverMediaId: true } },
      },
    }),
  ]);

  return {
    categories: categories.map((c) => ({ id: c.id, slug: c.slug, name: localized(locale, c.nameEn, c.nameHi) })),
    popularDevices: popularDevices.map((d) => ({ id: d.id, slug: d.slug, name: d.name, brand: d.brand.name, category: d.category.slug })),
    featuredProducts: products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: localized(locale, p.nameEn, p.nameHi),
      pricePaise: p.pricePaise,
      mrpPaise: p.mrpPaise,
      category: { slug: p.category.slug, name: localized(locale, p.category.nameEn, p.category.nameHi) },
      imageUrl: p.images[0] ? mediaUrl(p.images[0].mediaId) : null,
      inStock: p.inventory ? p.inventory.onHand > 0 : null,
      href: `/${locale}/protection/p/${p.slug}`,
    })),
    featuredDesigns: designs.map((d) => ({
      id: d.id,
      slug: d.slug,
      name: localized(locale, d.nameEn, d.nameHi),
      collection: d.collection,
      style: d.style,
      imageUrl: d.previewMediaId ? mediaUrl(d.previewMediaId) : null,
      basePricePaise: d.basePricePaise,
      href: `/${locale}/customize?design=${d.slug}`,
    })),
    latestArticles: articles.map((a) => ({
      type: a.contentItem.type,
      slug: a.contentItem.slug,
      topic: a.contentItem.topic,
      title: a.title,
      summary: a.summary,
      readingMinutes: a.readingMinutes,
      publishedAt: a.publishedAt ?? a.scheduledAt,
      coverUrl: a.contentItem.coverMediaId ? mediaUrl(a.contentItem.coverMediaId) : null,
      href: `/${locale}/${a.contentItem.type === "VIDEO" ? "videos" : "articles"}/${a.contentItem.slug}`,
    })),
  };
}
