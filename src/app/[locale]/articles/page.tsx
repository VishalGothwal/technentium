import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { ListingFilters, ListingResults, ListingSkeleton } from "@/components/content/listing";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/articles", title: t("articles.title"), description: t("articles.metaDescription") });
}

export default async function ArticlesPage({ searchParams }: PageProps<"/[locale]/articles">) {
  const { t, locale } = await getT();
  const base = `/${locale}/articles`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold tracking-wider text-primary uppercase">Technentium Journal</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">{t("articles.title")}</h1>
        <p className="mt-3 text-lg text-muted">{t("articles.subtitle")}</p>
      </header>
      <div className="mt-8">
        <ListingFilters basePath={base} type="ARTICLE" />
      </div>
      <div className="mt-8">
        <Suspense fallback={<ListingSkeleton />}>
          <ListingResults searchParams={searchParams} type="ARTICLE" basePath={base} />
        </Suspense>
      </div>
    </div>
  );
}
