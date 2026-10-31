import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { alignSpecs } from "@/lib/content/specs";
import { pageMetadata } from "@/lib/seo";
import { getComparisonDetail } from "@/server/modules/content/content.public";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { CompareTable } from "@/components/content/compare-client";
import { ArticleSkeleton } from "@/components/content/content-detail";
import { DeviceIllustration, SpecHighlights } from "@/components/content/specs";
import { RelatedGuides } from "@/components/content/related-guides";

export async function generateMetadata({ params }: PageProps<"/[locale]/compare/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { locale } = await getT();
  const c = await getComparisonDetail(slug);
  if (!c) notFound();
  const title = localized(locale, c.titleEn, c.titleHi);
  return pageMetadata({ locale, path: `/compare/${slug}`, title: c.seoTitle || title, description: c.metaDescription || localized(locale, c.introEn ?? "", c.introHi) || title });
}

async function Comparison({ params }: { params: PageProps<"/[locale]/compare/[slug]">["params"] }) {
  const { slug } = await params;
  const { t, locale } = await getT();
  const c = await getComparisonDetail(slug);
  if (!c || c.devices.length < 2) notFound();
  const title = localized(locale, c.titleEn, c.titleHi);
  const intro = localized(locale, c.introEn ?? "", c.introHi);
  const verdict = localized(locale, c.verdictEn ?? "", c.verdictHi);
  const devices = c.devices.map((d) => ({ slug: d.slug, name: d.deviceModel.name, brand: d.deviceModel.brand.name }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { name: t("articles.home"), path: `/${locale}` },
          { name: t("compare.title"), path: `/${locale}/compare` },
          { name: title, path: `/${locale}/compare/${slug}` },
        ]}
      />
      <header className="mt-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted">{intro}</p>}
      </header>

      <ul className={`mt-8 grid gap-4 ${devices.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {c.devices.map((d) => (
          <li key={d.slug} className="flex flex-col rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-4">
              <DeviceIllustration seed={d.slug} className="h-24 w-14 shrink-0" />
              <div>
                <p className="text-xs font-semibold tracking-wider text-muted uppercase">{d.deviceModel.brand.name}</p>
                <p className="text-xl font-bold">{d.deviceModel.name}</p>
                <Link href={`/${locale}/specs/${d.slug}`} className="text-sm font-medium text-primary hover:underline">
                  {t("compare.viewSpecs")} →
                </Link>
              </div>
            </div>
            <div className="mt-4">
              <SpecHighlights specs={d.specs} locale={locale} t={t} compact />
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-10" aria-label={t("specs.fullSpecs")}>
        <CompareTable devices={devices} groups={alignSpecs(c.devices.map((d) => d.specs))} />
      </section>

      {verdict && (
        <section className="mt-10 rounded-3xl bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground sm:p-8" aria-labelledby="verdict-title">
          <h2 id="verdict-title" className="text-2xl font-bold">
            {t("compare.verdict")}
          </h2>
          <p className="mt-3 text-lg leading-relaxed opacity-95">{verdict}</p>
          <Link href={`/${locale}/compare?ids=${devices.map((d) => d.slug).join(",")}`} className="mt-5 inline-flex h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold text-primary hover:bg-white/90">
            {t("compare.add")} →
          </Link>
        </section>
      )}

      <RelatedGuides topic="buying-guides" className="mt-14" />
    </div>
  );
}

export default function ComparisonPage({ params }: PageProps<"/[locale]/compare/[slug]">) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <Comparison params={params} />
    </Suspense>
  );
}
