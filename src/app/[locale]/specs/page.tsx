import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/cn";
import { getComparisonList, getSpecBrands, getSpecList } from "@/server/modules/content/content.public";
import { SpecCard } from "@/components/content/specs";
import { ListingSkeleton } from "@/components/content/listing";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/specs", title: t("specs.title"), description: t("specs.metaDescription") });
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Results({ searchParams }: { searchParams: PageProps<"/[locale]/specs">["searchParams"] }) {
  const { t, locale } = await getT();
  const sp = await searchParams;
  const q = first(sp.q)?.slice(0, 80) || null;
  const brand = first(sp.brand)?.slice(0, 40) || null;
  const [brands, specs] = await Promise.all([getSpecBrands(), getSpecList({ q, brand })]);
  const base = `/${locale}/specs`;
  const chip = (href: string, active: boolean, label: string) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:border-foreground/40",
      )}
    >
      {label}
    </Link>
  );
  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <nav aria-label={t("specs.allBrands")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex gap-2">
            <li>{chip(q ? `${base}?q=${encodeURIComponent(q)}` : base, !brand, t("specs.allBrands"))}</li>
            {brands.map((b) => (
              <li key={b.slug}>{chip(`${base}?brand=${b.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`, brand === b.slug, b.name)}</li>
            ))}
          </ul>
        </nav>
        <form action={base} role="search" className="relative w-full md:max-w-xs">
          {brand && <input type="hidden" name="brand" value={brand} />}
          <label htmlFor="spec-search" className="sr-only">
            {t("specs.searchLabel")}
          </label>
          <input id="spec-search" name="q" type="search" defaultValue={q ?? ""} placeholder={t("specs.searchPlaceholder")} className="h-11 w-full rounded-full border border-border bg-surface px-4 text-base sm:text-sm" />
        </form>
      </div>
      <p className="mt-6 text-sm text-muted" aria-live="polite">
        {t("specs.count", { n: specs.length })}
      </p>
      {specs.length === 0 ? (
        <p className="mt-4 rounded-3xl border border-dashed border-border bg-surface p-10 text-center text-lg font-semibold">{t("specs.noResults")}</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {specs.map((s) => (
            <li key={s.id}>
              <SpecCard spec={s} locale={locale} t={t} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-muted">{t("specs.unknownHint")}</p>
    </>
  );
}

async function Curated() {
  const { t, locale } = await getT();
  const list = await getComparisonList();
  if (!list.length) return null;
  return (
    <section className="mt-14" aria-labelledby="curated-title">
      <div className="flex items-end justify-between gap-4">
        <h2 id="curated-title" className="text-2xl font-bold tracking-tight">
          {t("compare.curated")}
        </h2>
        <Link href={`/${locale}/compare`} className="text-sm font-medium text-primary hover:underline">
          {t("compare.title")} →
        </Link>
      </div>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {list.map((c) => (
          <li key={c.id}>
            <Link href={`/${locale}/compare/${c.slug}`} className="group block h-full rounded-2xl border border-border bg-surface p-5 transition hover:border-primary">
              <p className="font-semibold group-hover:text-primary">{localized(locale, c.titleEn, c.titleHi)}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{localized(locale, c.introEn ?? "", c.introHi)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SpecsPage({ searchParams }: PageProps<"/[locale]/specs">) {
  const { t, locale } = await getT();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t("specs.title")}</h1>
          <p className="mt-3 text-lg text-muted">{t("specs.subtitle")}</p>
        </div>
        <Link href={`/${locale}/compare`} className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          {t("compare.title")}
        </Link>
      </header>
      <div className="mt-8">
        <Suspense fallback={<ListingSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
      <Curated />
    </div>
  );
}
