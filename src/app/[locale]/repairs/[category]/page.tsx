import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { getT } from "@/i18n/server";
import { localized, type TFunction } from "@/i18n/translate";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/cn";
import { getRepairCategory, listRepairCatalogue } from "@/server/modules/catalog/repair-pages.service";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { RepairDeviceSearch } from "@/components/repair/device-search";
import { BrandGrid, RepairFaq, SectionTitle } from "@/components/repair/blocks";
import { RepairJourney } from "@/components/repair/journey";
import { QuickBook } from "@/components/repair/quick-book";
import { IssueIcon } from "@/components/repair/visuals";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/repairs/[category]">): Promise<Metadata> {
  const { category: slug } = await params;
  const { t, locale } = await getT();
  const c = await getRepairCategory(slug);
  if (!c) return { title: t("errors.notFound.device"), robots: { index: false } };
  const title = t("repairFlow.categoryTitle", { device: localized(locale, c.nameEn, c.nameHi) });
  return pageMetadata({ locale, path: `/repairs/${c.slug}`, title, description: t("repairs.subtitle") });
}

// Resolved outside Suspense so an unknown category returns a real 404.
export default async function RepairCategoryPage({ params }: PageProps<"/[locale]/repairs/[category]">) {
  const { category: slug } = await params;
  const { t, locale } = await getT();
  const all = await listRepairCatalogue();
  const c = all.find((x) => x.slug === slug);
  if (!c) notFound();
  const name = localized(locale, c.nameEn, c.nameHi);
  const base = `/${locale}/repairs/${c.slug}`;
  const book = `/${locale}/repairs/book`;

  return (
    <div className="pb-16">
      {/* Brand grid with the quick booking card beside it */}
      <div className="mx-auto max-w-6xl gap-10 px-4 pt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Breadcrumbs
            items={[
              { name: t("nav.repairs"), path: `/${locale}/repairs` },
              { name, path: base },
            ]}
          />
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("site.categoryPage.title", { device: name })}</h1>
          <p className="mt-3 max-w-2xl text-muted">{t("site.categoryPage.subtitle")}</p>
          <RepairDeviceSearch className="mt-5 w-full sm:w-96" />

          <nav aria-label={t("repairFlow.otherDevices")} className="mt-5 flex flex-wrap gap-2">
            {all.map((x) => (
              <Link
                key={x.id}
                href={`/${locale}/repairs/${x.slug}`}
                aria-current={x.id === c.id ? "page" : undefined}
                className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", x.id === c.id ? "border-primary bg-primary text-white" : "border-border bg-surface hover:border-primary")}
              >
                {localized(locale, x.nameEn, x.nameHi)}
              </Link>
            ))}
          </nav>

          <section className="mt-8" aria-labelledby="brand-title">
            <h2 id="brand-title" className="mb-4 scroll-mt-24 text-lg font-semibold">
              {t("repairFlow.selectBrand")}
            </h2>
            <BrandGrid brands={c.brands} hrefFor={(b) => `${base}/${b}`} t={t} className="lg:grid-cols-4 xl:grid-cols-5" />
          </section>
        </div>
        <aside className="mt-12 lg:mt-0">
          <QuickBook
            className="lg:sticky lg:top-24"
            initialCategory={c.slug}
            categories={all.filter((x) => x.brands.length > 0).map((x) => ({ slug: x.slug, name: localized(locale, x.nameEn, x.nameHi), brands: x.brands.map((b) => ({ id: b.id, slug: b.slug, name: b.name })) }))}
          />
        </aside>
      </div>

      {c.issues.length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl px-4" aria-labelledby="issues-title">
          <SectionTitle id="issues-title">{t("site.categoryPage.issuesTitle", { device: name })}</SectionTitle>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.issues.map((i) => {
              const description = localized(locale, i.descriptionEn ?? "", i.descriptionHi);
              return (
                <li key={i.id}>
                  <Link href="#brand-title" className="flex h-full gap-4 rounded-2xl border border-border bg-surface p-5 lift hover:border-foreground">
                    <IssueIcon slug={i.slug} className="size-10 shrink-0 text-foreground" />
                    <span>
                      <span className="block font-semibold">{localized(locale, i.nameEn, i.nameHi)}</span>
                      {description && <span className="mt-1 block text-sm leading-relaxed text-muted">{description}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Compare t={t} device={name} book={book} />
      <RepairJourney t={t} />

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-black p-8 text-white sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">{t("site.categoryPage.ctaTitle", { device: name })}</h2>
            <p className="mt-2 text-white/75">{t("site.categoryPage.ctaBody")}</p>
          </div>
          <ButtonLink href={book} variant="inverse" size="lg" className="shrink-0 rounded-xl">
            {t("site.categoryPage.cta")}
          </ButtonLink>
        </div>
      </section>

      <RepairFaq t={t} className="mx-auto mt-16 max-w-4xl px-4" />
    </div>
  );
}

const points = (t: TFunction, key: "local" | "us" | "centre", count: number) => Array.from({ length: count }, (_, n) => t(`site.categoryPage.${key}.points.${n}`));

function CompareSide({ t, k }: { t: TFunction; k: "local" | "centre" }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-muted p-6 lg:my-6">
      <p className="font-semibold">{t(`site.categoryPage.${k}.title`)}</p>
      <ul className="mt-4 space-y-3 text-sm text-muted">
        {points(t, k, 4).map((p) => (
          <li key={p} className="flex gap-2.5">
            <X aria-hidden className="mt-0.5 size-4 shrink-0" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Three columns side by side: local shops, us (highlighted), brand service centres. */
function Compare({ t, device, book }: { t: TFunction; device: string; book: string }) {
  return (
    <section className="mx-auto mt-16 max-w-6xl px-4" aria-labelledby="compare-title">
      <SectionTitle id="compare-title" className="text-center">
        {t("site.categoryPage.compareTitle", { device })}
      </SectionTitle>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <CompareSide t={t} k="local" />
        <div className="rounded-2xl border-2 border-foreground bg-surface p-6 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.4)]">
          <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-white">{t("site.categoryPage.recommended")}</span>
          <p className="mt-4 font-display text-xl font-bold">{t("site.categoryPage.us.title")}</p>
          <ul className="mt-4 space-y-3 text-sm">
            {points(t, "us", 5).map((p) => (
              <li key={p} className="flex gap-2.5">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
                {p}
              </li>
            ))}
          </ul>
          <ButtonLink href={book} block className="mt-6 rounded-xl">
            {t("site.categoryPage.cta")}
          </ButtonLink>
        </div>
        <CompareSide t={t} k="centre" />
      </div>
    </section>
  );
}
