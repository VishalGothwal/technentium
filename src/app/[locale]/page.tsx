import type { Metadata } from "next";
import { Cpu, Palette, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { organizationJsonLd, pageMetadata, SITE_NAME, absoluteUrl } from "@/lib/seo";
import { readStyle } from "@/lib/customization/style";
import { HANDOVER_METHODS } from "@/lib/schemas/repair";
import { cachedDesigns } from "@/server/modules/customization/catalog.cached";
import { cachedFeaturedProducts } from "@/server/modules/shop/catalog.cached";
import { cachedHeaderNav } from "@/server/modules/catalog/nav.cached";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/surface";
import { RelatedGuides } from "@/components/content/related-guides";
import { DevicePreview } from "@/components/customization/device-preview";
import { ProductCard, ProductGrid } from "@/components/shop/product-card";
import { DeviceTypeTile } from "@/components/repair/blocks";
import { RepairProcess } from "@/components/repair/journey";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return { ...pageMetadata({ locale, path: "/", title: t("meta.title"), description: t("meta.description") }), title: { absolute: t("meta.title") } };
}

const SECTIONS = [
  { key: "repairs", path: "/repairs", Icon: Wrench },
  { key: "protection", path: "/protection", Icon: ShieldCheck },
  { key: "customize", path: "/customize", Icon: Palette },
  { key: "specs", path: "/compare", Icon: Cpu },
] as const;

export default async function HomePage() {
  const { t, locale } = await getT();
  const l = (path: string) => `/${locale}${path}`;
  const trust = ["pricing", "approval", "tracking", "warranty"] as const;

  return (
    <>
      <JsonLd
        data={[
          organizationJsonLd(),
          { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: absoluteUrl(`/${locale}`), inLanguage: locale === "hi" ? "hi-IN" : "en-IN" },
        ]}
      />

      {/* Hero: what Technentium does, with a card for each part of the site */}
      <section className="border-b border-border bg-surface-muted">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:py-16 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">{t("site.home.eyebrow")}</p>
            <h1 className="mt-3 text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl">{t("site.home.title")}</h1>
            <span aria-hidden className="mt-5 block h-0.5 w-10 bg-foreground" />
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t("site.home.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={l("/repairs")} size="lg" className="rounded-xl">
                {t("site.home.ctaRepair")}
              </ButtonLink>
              <ButtonLink href={l("/protection")} size="lg" variant="secondary" className="rounded-xl">
                {t("site.home.ctaShop")}
              </ButtonLink>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {(
                [
                  ["/track", "track"],
                  ["/guide", "guide"],
                  ["/help", "help"],
                ] as const
              ).map(([href, key]) => (
                <li key={key}>
                  <Link href={l(href)} className="font-medium underline-offset-4 hover:underline">
                    {t(`site.home.quick.${key}`)} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <ul className="grid grid-cols-2 gap-3">
            {SECTIONS.map(({ key, path, Icon }) => (
              <li key={key}>
                <Link href={l(path)} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-4 lift hover:border-foreground sm:p-5">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-surface-muted transition group-hover:bg-foreground group-hover:text-white">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="mt-4 font-semibold">{t(`site.home.sections.${key}.title`)}</span>
                  <span className="mt-1 hidden text-sm leading-snug text-muted sm:block">{t(`site.home.sections.${key}.body`)}</span>
                  <span className="mt-auto pt-4 text-sm font-semibold">
                    {t(`site.home.sections.${key}.cta`)} <span className="inline-block transition group-hover:translate-x-0.5">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Repairs: device types, then on to the repairs section */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading eyebrow={t("home.eyebrow")} title={t("site.home.repairTitle")} body={t("site.home.repairBody")} href={l("/repairs")} linkLabel={t("site.header.allRepairs")} />
        <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
          <DeviceTiles locale={locale} />
        </Suspense>
        <RepairProcess t={t} className="mt-8" />
        <ul className="mt-6 flex flex-wrap gap-2">
          {HANDOVER_METHODS.map((m) => (
            <li key={m} className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
              {t(`handover.${m}.title`)}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">{t("home.serviceArea")}</p>
      </section>

      {/* Protection */}
      <section className="border-y border-border bg-surface-muted">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionHeading eyebrow={t("site.home.sections.protection.title")} title={t("site.home.shopTitle")} body={t("site.home.shopBody")} href={l("/protection/products")} linkLabel={t("site.home.viewAll")} />
          <Suspense fallback={<GridSkeleton />}>
            <FeaturedProducts locale={locale} />
          </Suspense>
        </div>
      </section>

      {/* Customization */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <div className="grid items-center gap-10 rounded-3xl border border-border bg-surface-muted p-6 sm:p-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">{t("site.home.sections.customize.title")}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">{t("site.home.studioTitle")}</h2>
            <p className="mt-4 max-w-prose text-muted">{t("site.home.studioBody")}</p>
            <ButtonLink href={l("/customize/studio")} size="lg" className="mt-8 rounded-xl">
              {t("site.home.studioCta")}
            </ButtonLink>
          </div>
          <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
            <DesignShowcase locale={locale} />
          </Suspense>
        </div>
      </section>

      {/* Specs & compare */}
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <Link href={l("/compare")} className="group flex flex-col gap-4 rounded-3xl border border-border bg-surface p-6 lift hover:border-foreground sm:flex-row sm:items-center sm:p-8">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-muted">
            <Cpu aria-hidden className="size-6" />
          </span>
          <span className="flex-1">
            <span className="block text-xl font-bold tracking-tight">{t("site.home.sections.specs.title")}</span>
            <span className="mt-1 block text-muted">{t("site.home.sections.specs.body")}</span>
          </span>
          <span className="text-sm font-semibold">
            {t("site.home.sections.specs.cta")} <span className="inline-block transition group-hover:translate-x-0.5">→</span>
          </span>
        </Link>
      </section>

      {/* Guides (interlinking into the content hub) */}
      <div className="mx-auto max-w-6xl px-4 py-16">
        <Suspense fallback={<GridSkeleton />}>
          <RelatedGuides title={t("site.home.guidesTitle")} limit={3} />
        </Suspense>
      </div>

      {/* Trust */}
      <section className="border-y border-border bg-surface-muted">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight">{t("home.trustTitle")}</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trust.map((k) => (
              <div key={k} className="border-l-2 border-primary pl-4">
                <p className="font-semibold">{t(`home.trust.${k}.title`)}</p>
                <p className="mt-1 text-sm text-muted">{t(`home.trust.${k}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tracking */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-primary-soft p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{t("site.home.finalTitle")}</h2>
            <p className="mt-1 text-muted">{t("site.home.finalBody")}</p>
          </div>
          <ButtonLink href={l("/track")} className="shrink-0 rounded-xl">
            {t("site.home.finalCta")}
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

async function DeviceTiles({ locale }: { locale: Locale }) {
  const nav = await cachedHeaderNav();
  return (
    <ul className="mt-5 grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-5">
      {nav.repairs.map((c) => (
        <li key={c.slug}>
          <DeviceTypeTile href={`/${locale}/repairs/${c.slug}`} slug={c.slug} name={localized(locale, c.nameEn, c.nameHi)} imageId={c.image} />
        </li>
      ))}
    </ul>
  );
}

function SectionHeading({ eyebrow, title, body, href, linkLabel }: { eyebrow?: string; title: string; body: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-muted uppercase">{eyebrow}</p>}
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        <p className="mt-2 max-w-2xl text-muted">{body}</p>
      </div>
      <Link href={href} className="shrink-0 text-sm font-semibold text-primary hover:underline">
        {linkLabel} →
      </Link>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-64 rounded-2xl" />
      ))}
    </div>
  );
}

async function FeaturedProducts({ locale }: { locale: Locale }) {
  const { t } = await getT();
  const products = await cachedFeaturedProducts(4);
  if (products.length === 0) return null;
  return (
    <ProductGrid>
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} locale={locale} t={t} />
        </li>
      ))}
    </ProductGrid>
  );
}

async function DesignShowcase({ locale }: { locale: Locale }) {
  const designs = await cachedDesigns();
  const picks = (designs.filter((d) => d.featured).length >= 3 ? designs.filter((d) => d.featured) : designs).slice(0, 3);
  return (
    <ul className="grid grid-cols-3 items-end gap-3 sm:gap-5">
      {picks.map((d, i) => {
        const name = localized(locale, d.nameEn, d.nameHi);
        return (
          <li key={d.id} className={i === 1 ? "sm:-translate-y-6" : ""}>
            <Link href={`/${locale}/customize/studio?design=${d.slug}`} className="block transition hover:-translate-y-1">
              <DevicePreview kind="phone" style={readStyle(d.style)} finish="gloss" coverage="camera" label={name} className="mx-auto w-full max-w-40 drop-shadow-2xl" />
              <span className="mt-3 block text-center text-sm text-muted">{name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
