import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import type { Locale } from "@/i18n/config";
import { isAppError } from "@/server/errors";
import { getProductBySlug, relatedProducts, type ProductDetail } from "@/server/modules/shop/catalog.service";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata, SITE_NAME } from "@/lib/seo";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/cn";
import { JsonLd } from "@/components/seo/json-ld";
import { BuyBox } from "@/components/shop/buy-box";
import { Gallery } from "@/components/shop/gallery";
import { RelatedGuides } from "@/components/content/related-guides";
import { Price, ProductCard, ProductGrid, StockLabel } from "@/components/shop/product-card";

export const instant = false;

/** Memoised per request: metadata and the page share one lookup. */
const loadProduct = cache(async (slug: string): Promise<ProductDetail | null> => {
  try {
    return await getProductBySlug(slug);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") return null;
    throw e;
  }
});

export async function generateMetadata({ params }: PageProps<"/[locale]/protection/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { locale, t } = await getT();
  const p = await loadProduct(slug);
  if (!p) return { title: t("errors.notFound.product"), robots: { index: false } };
  const name = localized(locale, p.nameEn, p.nameHi);
  return pageMetadata({
    locale,
    path: `/protection/${p.slug}`,
    title: p.seoTitle || name,
    description: p.metaDescription || localized(locale, p.summaryEn ?? "", p.summaryHi) || t("shop.metaDescription"),
    image: p.images[0] ? mediaUrl(p.images[0].id) : null,
  });
}

// Resolved outside Suspense (blocking route) so an unknown slug returns a real 404 for search engines.
export default async function ProductPage({ params }: PageProps<"/[locale]/protection/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:pb-16">
      <Product params={params} />
    </div>
  );
}

const AVAILABILITY_SCHEMA = {
  in_stock: "https://schema.org/InStock",
  low_stock: "https://schema.org/LimitedAvailability",
  out_of_stock: "https://schema.org/OutOfStock",
  unknown: "https://schema.org/PreOrder",
} as const;

async function Product({ params }: { params: PageProps<"/[locale]/protection/[slug]">["params"] }) {
  const { slug } = await params;
  const { t, locale } = await getT();
  const p = await loadProduct(slug);
  if (!p) notFound();
  const related = await relatedProducts(p);

  const name = localized(locale, p.nameEn, p.nameHi);
  const summary = localized(locale, p.summaryEn ?? "", p.summaryHi);
  const description = localized(locale, p.descriptionEn ?? "", p.descriptionHi);
  const categoryName = localized(locale, p.category.nameEn, p.category.nameHi);
  const compatTotal = p.compatibilityByBrand.reduce((n, b) => n + b.models.length, 0);
  const url = `/${locale}/protection/${p.slug}`;
  const showCompat = !p.universal && compatTotal > 0;
  const tabs = [
    { id: "overview", label: t("shop.overview") },
    ...(description ? [{ id: "details", label: t("shop.description") }] : []),
    ...(p.specs.length > 0 ? [{ id: "specs", label: t("shop.specs") }] : []),
    ...(showCompat ? [{ id: "compatibility", label: t("shop.compatibleWith") }] : []),
  ];

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name,
            sku: p.sku,
            description: summary || description || undefined,
            category: categoryName,
            brand: { "@type": "Brand", name: SITE_NAME },
            image: p.images.map((i) => absoluteUrl(mediaUrl(i.id))),
            url: absoluteUrl(url),
            offers: {
              "@type": "Offer",
              priceCurrency: "INR",
              price: (p.pricePaise / 100).toFixed(2),
              availability: AVAILABILITY_SCHEMA[p.stock],
              url: absoluteUrl(url),
              areaServed: "IN",
            },
          },
          breadcrumbJsonLd([
            { name: t("shop.home"), path: `/${locale}` },
            { name: t("shop.title"), path: `/${locale}/protection` },
            { name: categoryName, path: `/${locale}/protection/products?category=${p.category.slug}` },
            { name, path: url },
          ]),
        ]}
      />

      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap gap-1 text-sm text-muted">
        <Link href={`/${locale}/protection`} className="hover:text-foreground">
          {t("shop.title")}
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/${locale}/protection/products?category=${p.category.slug}`} className="hover:text-foreground">
          {categoryName}
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate text-foreground" aria-current="page">
          {name}
        </span>
      </nav>

      <nav aria-label={t("shop.sections")} className="sticky top-16 z-10 -mx-4 mb-6 border-b border-border bg-background/95 px-4 backdrop-blur">
        <ul className="flex justify-center gap-6 overflow-x-auto text-sm scrollbar-none sm:gap-8">
          {tabs.map((tab, i) => (
            <li key={tab.id}>
              <a href={`#${tab.id}`} className={cn("block border-b-2 py-3 whitespace-nowrap transition hover:text-foreground", i === 0 ? "border-foreground font-semibold" : "border-transparent text-muted")}>
                {tab.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div id="overview" className="grid scroll-mt-32 grid-cols-1 gap-8 md:grid-cols-[1.25fr_1fr] lg:gap-14">
        <div className="min-w-0 md:sticky md:top-32 md:self-start">
          <Gallery images={p.images.map((i) => ({ id: i.id, alt: localized(locale, i.altEn ?? "", i.altHi) }))} categorySlug={p.category.slug} typeSlug={p.typeInfo?.slug} name={name} />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
            {categoryName}
            {p.typeInfo && (
              <>
                {" · "}
                <Link href={`/${locale}/protection/products?category=${p.category.slug}&type=${p.typeInfo.slug}`} className="text-foreground hover:underline">
                  {localized(locale, p.typeInfo.nameEn, p.typeInfo.nameHi)}
                </Link>
              </>
            )}
          </p>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl">{name}</h1>
          {summary && <p className="mt-4 text-sm leading-relaxed text-foreground/85 sm:text-base">{summary}</p>}
          {description && (
            <a href="#details" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-info underline-offset-4 hover:underline">
              {t("shop.readMore")} <span aria-hidden>⌄</span>
            </a>
          )}

          <div className="mt-5 space-y-1">
            <Price pricePaise={p.pricePaise} mrpPaise={p.mrpPaise} locale={locale} t={t} size="lg" />
            <p className="text-xs text-muted">{t("shop.inclTax")}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <StockLabel stock={p.stock} t={t} className="text-sm" />
            <span className="text-xs text-muted">
              {t("shop.sku")} {p.sku}
            </span>
          </div>

          {p.typeInfo?.descriptionEn && (
            <div className="mt-5 rounded-lg border border-border bg-surface-muted p-4 text-sm">
              <p className="font-semibold">{t("shop.aboutType", { type: localized(locale, p.typeInfo.nameEn, p.typeInfo.nameHi) })}</p>
              <p className="mt-1 leading-relaxed text-muted">{localized(locale, p.typeInfo.descriptionEn, p.typeInfo.descriptionHi)}</p>
              <Link href={`/${locale}/protection#types`} className="mt-2 inline-block font-semibold underline-offset-4 hover:underline">
                {t("shop.compareTypes")}
              </Link>
            </div>
          )}

          <div className="mt-6">
            <BuyBox productId={p.id} name={name} pricePaise={p.pricePaise} universal={p.universal} outOfStock={p.stock === "out_of_stock"} />
          </div>

          <div className="mt-6 border-t border-border pt-4 text-sm">
            <p className="font-semibold text-info">{t("shop.deliveryTitle")}</p>
            <p className="mt-1 text-muted">{t("shop.deliveryNote")}</p>
            <p className="mt-2 text-muted">{t("shop.requestNote")}</p>
          </div>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-8">
          {description && (
            <section id="details" aria-labelledby="desc-title" className="scroll-mt-32">
              <h2 id="desc-title" className="font-display text-3xl font-bold tracking-tight">
                {t("shop.description")}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-foreground/90">
                {description.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )}
          {p.specs.length > 0 && (
            <section id="specs" aria-labelledby="specs-title" className="scroll-mt-32">
              <h2 id="specs-title" className="font-display text-3xl font-bold tracking-tight">
                {t("shop.specs")}
              </h2>
              <dl className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {p.specs.map((s) => (
                  <div key={s.labelEn} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 px-4 py-3 text-sm">
                    <dt className="text-muted">{localized(locale, s.labelEn, s.labelHi)}</dt>
                    <dd className="font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        {showCompat && (
          <section id="compatibility" aria-labelledby="compat-title" className="scroll-mt-32">
            <h2 id="compat-title" className="font-display text-3xl font-bold tracking-tight">
              {t("shop.compatibleWith")} <span className="text-base font-normal text-muted">· {t("shop.compatibleCount", { count: compatTotal })}</span>
            </h2>
            <div className="mt-3 space-y-2">
              {p.compatibilityByBrand.map((b) => (
                <details key={b.brand} className="group rounded-lg border border-border bg-surface" open={p.compatibilityByBrand.length <= 2}>
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                    {b.brand}
                    <span className="text-sm font-normal text-muted">
                      {b.models.length} <span aria-hidden className="inline-block transition group-open:rotate-180">⌄</span>
                    </span>
                  </summary>
                  <ul className="flex flex-wrap gap-2 px-4 pb-4">
                    {b.models.map((m) => (
                      <li key={m.id}>
                        <Link
                          href={`/${locale}/protection/products?device=${m.id}`}
                          className="inline-block rounded-full border border-border px-3 py-1 text-sm hover:border-primary hover:text-primary"
                          title={m.note ?? undefined}
                        >
                          {m.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-14" aria-labelledby="related-title">
          <h2 id="related-title" className="font-display text-3xl font-bold tracking-tight">
            {t("shop.related")}
          </h2>
          <ProductGrid className="mt-5">
            {related.map((r) => (
              <li key={r.id}>
                <ProductCard product={r} locale={locale as Locale} t={t} />
              </li>
            ))}
          </ProductGrid>
        </section>
      )}
      <Suspense fallback={null}>
        <RelatedGuides topic="protection" className="mt-14" />
      </Suspense>
    </>
  );
}
