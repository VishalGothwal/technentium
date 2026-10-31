import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import type { Locale } from "@/i18n/config";
import { cachedFeaturedProducts, cachedProductCategories, cachedProductTypes } from "@/server/modules/shop/catalog.cached";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Skeleton } from "@/components/ui/surface";
import { DeviceShopper } from "@/components/shop/device-shopper";
import { ProductCard } from "@/components/shop/product-card";
import { ProductVisual } from "@/components/shop/product-visual";
import { Chevron, Rail } from "@/components/shop/rail";
import { TypeGuide } from "@/components/shop/type-guide";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/protection", title: t("shop.metaTitle"), description: t("shop.metaDescription") });
}

const SOLID_LINK = "inline-flex h-11 items-center bg-white px-5 text-xs font-bold tracking-[0.12em] text-foreground uppercase transition hover:bg-white/85";

export default async function ProtectionLandingPage() {
  const { t, locale } = await getT();
  const trust = [t("shop.trustFit"), t("shop.trustIndia"), t("shop.trustNoPay"), t("shop.trustSupport")];
  const how = [1, 2, 3].map((n) => ({ n, title: t(`shop.how${n}Title`), body: t(`shop.how${n}Body`) }));
  const promos = [
    { slug: "cases-covers", title: t("shop.shopCases"), href: `/${locale}/protection/products?category=cases-covers` },
    { slug: "chargers-cables", title: t("shop.shopAccessories"), href: `/${locale}/protection/products` },
  ];

  return (
    <div className="pb-16">
      <JsonLd data={breadcrumbJsonLd([{ name: t("shop.home"), path: `/${locale}` }, { name: t("shop.title"), path: `/${locale}/protection` }])} />

      {/* Hero: full-bleed black, headline anchored bottom-left */}
      <section className="relative overflow-hidden bg-black text-white">
        <div aria-hidden className="absolute -top-32 right-0 size-[28rem] rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
        <div className="relative mx-auto grid min-h-[30rem] max-w-6xl grid-cols-1 gap-6 px-4 py-10 md:min-h-[34rem] md:grid-cols-[1.15fr_1fr] md:items-end md:pb-14">
          <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[15rem] md:order-2 md:max-w-sm md:self-center">
            <div className="absolute inset-4 rotate-6 overflow-hidden rounded-[2rem] shadow-2xl shadow-black/50">
              <ProductVisual imageId={null} categorySlug="cases-covers" />
            </div>
            <div className="absolute inset-4 -translate-x-[12%] translate-y-[8%] -rotate-6 overflow-hidden rounded-[2rem] shadow-2xl shadow-black/50">
              <ProductVisual imageId={null} categorySlug="earbud-cases" />
            </div>
          </div>
          <div className="md:order-1">
            <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-white/80 uppercase">{t("shop.heroNewEyebrow")}</p>
            <h1 className="mt-2 font-display text-5xl leading-[0.95] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">{t("shop.heroNewTitle")}</h1>
            <p className="mt-4 max-w-md text-sm text-white/85 sm:text-base">{t("shop.heroNewBody")}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href={`/${locale}/protection/products?category=cases-covers`} className={SOLID_LINK}>
                {t("shop.shopCases")}
              </Link>
              <Link href={`/${locale}/protection/products`} className="inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.12em] uppercase underline-offset-4 hover:underline">
                {t("shop.shopAccessories")}
                <Chevron className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<Skeleton className="h-14 w-full rounded-none" />}>
        <CategoryStrip locale={locale} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <Trending locale={locale} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <ShopByType locale={locale} />
      </Suspense>

      {/* Two editorial promos: covers, and every other accessory */}
      <section className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-4 px-4 sm:grid-cols-2">
        {promos.map((p) => (
          <Link key={p.slug} href={p.href} className="group relative block aspect-[4/3] overflow-hidden rounded-lg bg-surface-muted">
            <ProductVisual imageId={null} categorySlug={p.slug} className="transition duration-500 group-hover:scale-105" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
            <span className="absolute bottom-5 left-5 inline-flex items-center gap-2 font-display text-2xl font-bold text-white sm:text-3xl">
              {p.title}
              <Chevron className="size-5 transition group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </section>

      <section id="for-my-device" className="mx-auto mt-16 max-w-6xl scroll-mt-24 px-4">
        <div className="rounded-lg bg-surface-muted p-5 sm:p-8">
          <h2 className="font-display text-3xl font-bold tracking-tight">{t("shop.shopForDevice")}</h2>
          <p className="mt-1 mb-5 text-sm text-muted">{t("shop.shopForDeviceBody")}</p>
          <DeviceShopper />
        </div>
      </section>

      <ul className="mx-auto mt-10 grid max-w-6xl grid-cols-2 gap-x-4 gap-y-5 px-4 md:grid-cols-4">
        {trust.map((line, i) => (
          <li key={line} className="flex items-center gap-3 text-sm font-medium">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-white">
              {["✓", "⇄", "₹", "★"][i]}
            </span>
            {line}
          </li>
        ))}
      </ul>

      <section className="mx-auto mt-16 max-w-6xl px-4" aria-labelledby="how-title">
        <h2 id="how-title" className="font-display text-3xl font-bold tracking-tight">
          {t("shop.howTitle")}
        </h2>
        <ol className="mt-6 grid gap-px overflow-hidden rounded-lg bg-border md:grid-cols-3">
          {how.map((s) => (
            <li key={s.n} className="bg-surface p-6">
              <span aria-hidden className="font-display text-4xl font-bold text-muted/40">
                0{s.n}
              </span>
              <p className="mt-2 font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-4">
        <div className="flex flex-col items-start gap-4 rounded-lg bg-foreground p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="font-display text-2xl font-bold">{t("shop.repairCtaTitle")}</p>
            <p className="text-sm text-white/75">{t("shop.repairCtaBody")}</p>
          </div>
          <Link href={`/${locale}/repairs/book`} className={SOLID_LINK}>
            {t("shop.repairCta")}
          </Link>
        </div>
      </section>
    </div>
  );
}

/** Glass and case types side by side with a comparison table each. */
async function ShopByType({ locale }: { locale: Locale }) {
  const { t } = await getT();
  const [glass, cases] = await Promise.all([cachedProductTypes("screen-protectors"), cachedProductTypes("cases-covers")]);
  if (!glass.length && !cases.length) return null;
  return (
    <section id="types" aria-labelledby="types-title" className="mx-auto mt-16 max-w-6xl scroll-mt-24 space-y-12 px-4">
      <div className="max-w-2xl">
        <h2 id="types-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t("shop.shopByType")}
        </h2>
        <p className="mt-2 text-muted">{t("shop.shopByTypeBody")}</p>
      </div>
      <TypeGuide title={t("shop.whichGlass")} types={glass} locale={locale} t={t} />
      <TypeGuide title={t("shop.whichCase")} types={cases} locale={locale} t={t} />
    </section>
  );
}

/** Bordered category bar under the hero; scrolls sideways when the categories don't fit. */
async function CategoryStrip({ locale }: { locale: Locale }) {
  const { t } = await getT();
  const categories = await cachedProductCategories();
  return (
    <nav aria-label={t("shop.categoriesTitle")} className="border-b border-border bg-surface">
      <Rail className="mx-auto max-w-6xl" listClassName="divide-x divide-border">
        {categories.map((c) => (
          <li key={c.id} className="min-w-[9.5rem] flex-1 snap-start">
            <Link
              href={`/${locale}/protection/products?category=${c.slug}`}
              className="flex h-14 items-center justify-center px-4 text-center text-[0.8rem] font-medium whitespace-nowrap transition hover:bg-surface-muted"
            >
              {localized(locale, c.nameEn, c.nameHi)}
            </Link>
          </li>
        ))}
      </Rail>
    </nav>
  );
}

async function Trending({ locale }: { locale: Locale }) {
  const { t } = await getT();
  const products = await cachedFeaturedProducts(10);
  if (products.length === 0) return null;
  return (
    <section className="mx-auto mt-14 max-w-6xl px-4" aria-labelledby="trending-title">
      <div className="flex items-end justify-between gap-4">
        <h2 id="trending-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t("shop.trendingTitle")}
        </h2>
        <Link href={`/${locale}/protection/products?sort=featured`} className="text-sm font-semibold underline-offset-4 hover:underline">
          {t("shop.viewAll")}
        </Link>
      </div>
      <Rail className="mt-6" listClassName="gap-3 sm:gap-4">
        {products.map((p, i) => (
          <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23.5%]">
            <ProductCard product={p} locale={locale} t={t} priority={i < 2} />
          </li>
        ))}
      </Rail>
    </section>
  );
}

function SectionSkeleton() {
  return (
    <div className="mx-auto mt-14 grid max-w-6xl grid-cols-2 gap-3 px-4 sm:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  );
}
