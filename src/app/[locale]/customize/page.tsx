import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { cachedDesigns } from "@/server/modules/customization/catalog.cached";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/surface";
import { JsonLd } from "@/components/seo/json-ld";
import { DesignGallery } from "@/components/customization/design-gallery";
import { HeroShowcase } from "@/components/customization/hero-showcase";
import { Glow, StudioTheme } from "@/components/customization/studio-theme";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/customize", title: t("studio.meta.title"), description: t("studio.meta.description") });
}

async function Showcase() {
  const { t, locale } = await getT();
  const designs = await cachedDesigns();
  const featured = designs.filter((d) => d.featured).slice(0, 6);
  return <HeroShowcase label={t("studio.preview.generic")} designs={(featured.length ? featured : designs.slice(0, 6)).map((d) => ({ slug: d.slug, name: localized(locale, d.nameEn, d.nameHi), style: d.style }))} />;
}

async function Gallery() {
  const designs = await cachedDesigns();
  return <DesignGallery designs={designs} />;
}

export default async function CustomizePage() {
  const { t, locale } = await getT();
  const steps = [1, 2, 3] as const;

  return (
    <StudioTheme>
      <JsonLd data={breadcrumbJsonLd([{ name: t("nav.home"), path: `/${locale}` }, { name: t("nav.customization"), path: `/${locale}/customize` }])} />

      <section className="relative isolate overflow-hidden">
        <Glow />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">{t("studio.hero.eyebrow")}</p>
            <h1 className="mt-3 bg-gradient-to-r from-white via-violet-200 to-fuchsia-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
              {t("studio.hero.title")}
            </h1>
            <p className="mt-4 max-w-prose text-lg text-muted">{t("studio.hero.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={`/${locale}/customize/studio`} size="lg">
                {t("studio.hero.cta")}
              </ButtonLink>
              <ButtonLink href="#designs" size="lg" variant="secondary">
                {t("studio.hero.browse")}
              </ButtonLink>
            </div>
          </div>
          <Suspense fallback={<Skeleton className="mx-auto aspect-[4/5] w-full max-w-sm rounded-3xl" />}>
            <Showcase />
          </Suspense>
        </div>
      </section>

      <section aria-labelledby="how" className="border-y border-border bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="how" className="text-2xl font-bold tracking-tight">
            {t("studio.how.title")}
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((n) => (
              <li key={n} className="rounded-2xl border border-border bg-surface p-5">
                <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 font-bold text-[#1a1033]" aria-hidden>
                  {n}
                </span>
                <h3 className="mt-4 font-semibold">{t(`studio.how.s${n}Title`)}</h3>
                <p className="mt-1 text-sm text-muted">{t(`studio.how.s${n}Body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="designs" aria-labelledby="designs-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
        <h2 id="designs-title" className="text-2xl font-bold tracking-tight">
          {t("studio.gallery.title")}
        </h2>
        <p className="mt-1 mb-6 text-muted">{t("studio.gallery.subtitle")}</p>
        <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
          <Gallery />
        </Suspense>
      </section>
    </StudioTheme>
  );
}
