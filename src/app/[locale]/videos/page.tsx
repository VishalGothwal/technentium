import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { ListingResults, ListingSkeleton } from "@/components/content/listing";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/videos", title: t("videos.title"), description: t("videos.metaDescription") });
}

export default async function VideosPage({ searchParams }: PageProps<"/[locale]/videos">) {
  const { t, locale } = await getT();
  return (
    <div className="bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-6 sm:pt-16">
        <p className="text-sm font-semibold tracking-wider text-white/60 uppercase">Technentium</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{t("videos.title")}</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-300">{t("videos.subtitle")}</p>
      </div>
      <div className="bg-background pt-8 pb-14 text-foreground [clip-path:inset(0)]">
        <div className="mx-auto max-w-6xl px-4">
          <Suspense fallback={<ListingSkeleton />}>
            <ListingResults searchParams={searchParams} type="VIDEO" basePath={`/${locale}/videos`} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
