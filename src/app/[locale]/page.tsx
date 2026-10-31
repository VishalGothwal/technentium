import type { Metadata } from "next";
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
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/surface";
import { RelatedGuides } from "@/components/content/related-guides";
import { DevicePreview } from "@/components/customization/device-preview";
import { ProductCard, ProductGrid } from "@/components/shop/product-card";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return { ...pageMetadata({ locale, path: "/", title: t("meta.title"), description: t("meta.description") }), title: { absolute: t("meta.title") } };
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  repairs: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />,
  protection: <path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6z" />,
  customize: (
    <>
      <circle cx="13.5" cy="6.5" r="1.5" />
      <circle cx="17.5" cy="10.5" r="1.5" />
      <circle cx="8.5" cy="7.5" r="1.5" />
      <path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 3-4 3h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z" />
    </>
  ),
  specs: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M10 18h4" />
    </>
  ),
};

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {SECTION_ICONS[name]}
    </svg>
  );
}

export default async function HomePage() {
  const { t, locale } = await getT();
  const l = (path: string) => `/${locale}${path}`;
  const sections = [
    { key: "repairs", href: l("/repairs"), tone: "from-white/15 to-white/5 text-white" },
    { key: "protection", href: l("/protection"), tone: "from-white/15 to-white/5 text-white" },
    { key: "customize", href: l("/customize"), tone: "from-white/15 to-white/5 text-white" },
    { key: "specs", href: l("/compare"), tone: "from-white/15 to-white/5 text-white" },
  ];
  const steps = ["book", "confirm", "quote", "return"] as const;
  const trust = ["pricing", "approval", "tracking", "warranty"] as const;

  return (
    <>
      <JsonLd
        data={[
          organizationJsonLd(),
          { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: absoluteUrl(`/${locale}`), inLanguage: locale === "hi" ? "hi-IN" : "en-IN" },
        ]}
      />

      {/* Hero: the platform at a glance */}
      <section className="relative isolate overflow-hidden bg-black text-white">
        <div aria-hidden className="absolute -top-40 -left-32 -z-10 size-[28rem] rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -right-24 -bottom-48 -z-10 size-[30rem] rounded-full bg-white/5 blur-3xl" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.1fr_1fr] md:items-center md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">{t("site.home.eyebrow")}</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-balance sm:text-5xl lg:text-6xl">{t("site.home.title")}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">{t("site.home.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={l("/repairs/book")} size="lg" variant="inverse" className="rounded-xl">
                {t("site.home.ctaRepair")}
              </ButtonLink>
              <ButtonLink href={l("/protection")} size="lg" variant="secondary" className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20">
                {t("site.home.ctaShop")}
              </ButtonLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {(
                [
                  ["/track", "track"],
                  ["/guide", "guide"],
                  ["/help", "help"],
                ] as const
              ).map(([href, key]) => (
                <li key={key}>
                  <Link href={l(href)} className="text-slate-300 underline-offset-4 hover:text-white hover:underline">
                    {t(`site.home.quick.${key}`)} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <ul className="grid grid-cols-2 gap-3">
            {sections.map((s) => (
              <li key={s.key}>
                <Link
                  href={s.href}
                  className={`group flex h-full flex-col rounded-2xl border border-white/10 bg-gradient-to-br ${s.tone} p-4 backdrop-blur transition hover:border-white/30 hover:bg-white/5 sm:p-5`}
                >
                  <Icon name={s.key} className="size-7" />
                  <span className="mt-3 font-semibold text-white">{t(`site.home.sections.${s.key}.title`)}</span>
                  <span className="mt-1 hidden text-sm leading-snug text-slate-300 sm:block">{t(`site.home.sections.${s.key}.body`)}</span>
                  <span className="mt-auto pt-3 text-sm font-medium">
                    {t(`site.home.sections.${s.key}.cta`)} <span className="inline-block transition group-hover:translate-x-0.5">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Repairs */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("home.eyebrow")}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">{t("site.home.repairTitle")}</h2>
            <p className="mt-3 text-muted">{t("site.home.repairBody")}</p>
            <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">{t("site.home.handoverTitle")}</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {HANDOVER_METHODS.map((m) => (
                <li key={m} className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
                  {t(`handover.${m}.title`)}
                </li>
              ))}
            </ul>
            <ButtonLink href={l("/repairs/book")} className="mt-8 rounded-xl">
              {t("home.cta")}
            </ButtonLink>
            <p className="mt-3 text-sm text-muted">{t("home.serviceArea")}</p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s} className="rounded-2xl border border-border bg-surface p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">{i + 1}</span>
                <p className="mt-4 font-semibold">{t(`home.steps.${s}.title`)}</p>
                <p className="mt-1 text-sm text-muted">{t(`home.steps.${s}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Protection */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionHeading title={t("site.home.shopTitle")} body={t("site.home.shopBody")} href={l("/protection/products")} linkLabel={t("site.home.viewAll")} />
          <Suspense fallback={<GridSkeleton />}>
            <FeaturedProducts locale={locale} />
          </Suspense>
        </div>
      </section>

      {/* Customization */}
      <section className="relative isolate overflow-hidden bg-black text-white">
        <div aria-hidden className="absolute top-0 right-0 -z-10 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {t("site.home.studioTitle")}
            </h2>
            <p className="mt-4 max-w-prose text-white/70">{t("site.home.studioBody")}</p>
            <ButtonLink href={l("/customize/studio")} size="lg" variant="inverse" className="mt-8 rounded-xl">
              {t("site.home.studioCta")}
            </ButtonLink>
          </div>
          <Suspense fallback={<Skeleton className="h-64 rounded-3xl bg-white/10" />}>
            <DesignShowcase locale={locale} />
          </Suspense>
        </div>
      </section>

      {/* Guides (interlinking into the content hub) */}
      <div className="mx-auto max-w-6xl px-4 py-16">
        <Suspense fallback={<GridSkeleton />}>
          <RelatedGuides title={t("site.home.guidesTitle")} limit={3} />
        </Suspense>
      </div>

      {/* Trust */}
      <section className="border-y border-border bg-surface">
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

function SectionHeading({ title, body, href, linkLabel }: { title: string; body: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        <p className="mt-2 text-muted">{body}</p>
      </div>
      <Link href={href} className="text-sm font-semibold text-primary hover:underline">
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
              <span className="mt-3 block text-center text-sm text-white/80">{name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
