import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { deviceName } from "@/lib/content/specs";
import { formatDate, formatPaise } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import {
  getArticlesForSpec,
  getComparisonList,
  getSpecDetail,
} from "@/server/modules/content/content.public";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { ArticleSkeleton } from "@/components/content/content-detail";
import {
  DeviceIllustration,
  SpecHighlights,
  SpecTable,
} from "@/components/content/specs";
import { JsonLd } from "@/components/seo/json-ld";
import { PhotoOr3D } from "@/components/device/photo-or-3d";
import { deviceKindFor } from "@/lib/customization/style";
import { cachedFeatures } from "@/server/features";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/specs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { t, locale } = await getT();
  const s = await getSpecDetail(slug);
  if (!s) notFound();
  const name = deviceName(s.deviceModel.brand.name, s.deviceModel.name);
  return pageMetadata({
    locale,
    path: `/specs/${slug}`,
    title: s.seoTitle || `${name} — ${t("specs.fullSpecs")}`,
    description:
      s.metaDescription ||
      localized(locale, s.summaryEn ?? "", s.summaryHi) ||
      t("specs.metaDescription"),
    image: s.imageMediaId ? mediaUrl(s.imageMediaId) : null,
  });
}

async function SpecDetail({
  params,
}: {
  params: PageProps<"/[locale]/specs/[slug]">["params"];
}) {
  const { slug } = await params;
  const { t, locale } = await getT();
  const s = await getSpecDetail(slug);
  if (!s) notFound();
  const name = deviceName(s.deviceModel.brand.name, s.deviceModel.name);
  const [articles, comparisons, features] = await Promise.all([
    getArticlesForSpec(s.id, locale),
    getComparisonList(),
    cachedFeatures(),
  ]);
  const comparisonIds = new Set(s.comparisons.map((c) => c.comparison.id));
  const mine = comparisons.filter((c) => comparisonIds.has(c.id));
  const summary = localized(locale, s.summaryEn ?? "", s.summaryHi);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name,
          brand: { "@type": "Brand", name: s.deviceModel.brand.name },
          description: summary || undefined,
          releaseDate: s.releaseDate?.toISOString().slice(0, 10),
          image: s.imageMediaId
            ? absoluteUrl(mediaUrl(s.imageMediaId))
            : undefined,
          url: absoluteUrl(`/${locale}/specs/${slug}`),
        }}
      />
      <Breadcrumbs
        items={[
          { name: t("articles.home"), path: `/${locale}` },
          { name: t("specs.title"), path: `/${locale}/specs` },
          { name, path: `/${locale}/specs/${slug}` },
        ]}
      />
      <header className="mt-6 grid items-center gap-8 rounded-3xl bg-gradient-to-br from-black to-neutral-900 p-6 text-white sm:p-10 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-semibold tracking-wider text-white/60 uppercase">
            {s.deviceModel.brand.name}
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {s.deviceModel.name}
          </h1>
          {summary && (
            <p className="mt-3 max-w-xl text-lg text-slate-300">{summary}</p>
          )}
          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
            {s.releaseDate && (
              <div>
                <dt className="sr-only">{t("specs.released", { date: "" })}</dt>
                <dd>
                  {t("specs.released", {
                    date: formatDate(s.releaseDate, locale),
                  })}
                </dd>
              </div>
            )}
            {s.launchPricePaise != null && (
              <div className="flex gap-1">
                <dt>{t("specs.launchPrice")}:</dt>
                <dd className="font-semibold text-white">
                  {formatPaise(s.launchPricePaise, locale)}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/compare?ids=${s.slug}`}
              className="inline-flex h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold text-slate-900 hover:bg-white/90"
            >
              {t("specs.compareWith")}
            </Link>
            <Link
              href={`/${locale}/protection`}
              className="inline-flex h-11 items-center rounded-lg border border-white/30 px-5 text-sm font-semibold hover:bg-white/10"
            >
              {t("specs.protectThis")}
            </Link>
            <Link
              href={`/${locale}/repairs/book`}
              className="inline-flex h-11 items-center rounded-lg border border-white/30 px-5 text-sm font-semibold hover:bg-white/10"
            >
              {t("specs.repairThis")}
            </Link>
          </div>
        </div>
        <div className="hidden justify-center md:flex">
          {s.imageMediaId ? (
            // Light stage so white-background product shots blend in (multiply) on the dark header.
            <div className="flex h-72 w-64 items-center justify-center rounded-3xl bg-[radial-gradient(circle_at_50%_40%,#ffffff_0%,#e9ecf2_75%)] p-5 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- media route serves re-encoded WebP */}
              <img
                src={mediaUrl(s.imageMediaId)}
                alt={name}
                className="max-h-full max-w-full object-contain mix-blend-multiply"
              />
            </div>
          ) : (
            <DeviceIllustration
              seed={s.slug}
              className="h-64 w-auto -rotate-6 drop-shadow-2xl"
            />
          )}
        </div>
      </header>

      <section className="mt-8" aria-labelledby="highlights-title">
        <h2 id="highlights-title" className="sr-only">
          {t("specs.highlights")}
        </h2>
        <SpecHighlights specs={s.specs} locale={locale} t={t} />
      </section>

      {features.preview3d.specs && (
        <section
          className="mt-8 grid items-center gap-6 overflow-hidden rounded-3xl border border-border bg-[radial-gradient(circle_at_30%_40%,#2a2352_0%,#0b0c14_70%)] p-6 text-white sm:p-8 md:grid-cols-[1fr_minmax(0,22rem)]"
          aria-labelledby="view-3d-title"
        >
          <div>
            <h2
              id="view-3d-title"
              className="text-2xl font-bold tracking-tight"
            >
              {t("specs.view3d")}
            </h2>
            <p className="mt-2 max-w-md text-white/70">
              {t("specs.view3dHint")}
            </p>
          </div>
          <PhotoOr3D
            imageId={s.imageMediaId}
            alt={name}
            labels={{ photo: t("specs.photo"), view3d: "3D", open3d: t("specs.open3d") }}
            kind={deviceKindFor(s.deviceModel.category.slug)}
            frame={s.deviceModel.frame}
            model3d={s.deviceModel.model3d}
            initialView="back"
            dark
            label={t("studio.preview.view3d", { device: name })}
            className="h-80 w-full"
          />
        </section>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="full-specs-title">
          <h2
            id="full-specs-title"
            className="mb-4 text-2xl font-bold tracking-tight"
          >
            {t("specs.fullSpecs")}
          </h2>
          <SpecTable specs={s.specs} locale={locale} t={t} />
          <p className="mt-4 text-sm text-muted">{t("specs.unknownHint")}</p>
        </section>
        <aside className="space-y-8">
          {mine.length > 0 && (
            <section aria-labelledby="spec-comparisons">
              <h2
                id="spec-comparisons"
                className="text-sm font-semibold tracking-wide text-muted uppercase"
              >
                {t("specs.comparisons")}
              </h2>
              <ul className="mt-3 space-y-2">
                {mine.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/${locale}/compare/${c.slug}`}
                      className="block rounded-xl border border-border bg-surface p-3 font-medium hover:border-primary hover:text-primary"
                    >
                      {localized(locale, c.titleEn, c.titleHi)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {articles.length > 0 && (
            <section aria-labelledby="spec-guides">
              <h2
                id="spec-guides"
                className="text-sm font-semibold tracking-wide text-muted uppercase"
              >
                {t("specs.relatedArticles")}
              </h2>
              <ul className="mt-3 space-y-2">
                {articles.map((a) => (
                  <li key={a.href}>
                    <Link
                      href={a.href}
                      className="group block rounded-xl border border-border bg-surface p-3 hover:border-primary"
                    >
                      <span className="font-medium group-hover:text-primary">
                        {a.title}
                      </span>
                      {a.summary && (
                        <span className="mt-1 line-clamp-2 block text-sm text-muted">
                          {a.summary}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function SpecPage({
  params,
}: PageProps<"/[locale]/specs/[slug]">) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <SpecDetail params={params} />
    </Suspense>
  );
}
