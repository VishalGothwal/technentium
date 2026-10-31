import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { CONTENT_TOPICS, isContentTopic } from "@/lib/schemas/content";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { ListingFilters, ListingResults, ListingSkeleton } from "@/components/content/listing";

// Topics are prerendered (generateStaticParams), so params are awaited outside Suspense to keep ISR.
export const instant = false;

export async function generateStaticParams() {
  return CONTENT_TOPICS.map((topic) => ({ topic }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/articles/topic/[topic]">): Promise<Metadata> {
  const { topic } = await params;
  if (!isContentTopic(topic)) notFound();
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: `/articles/topic/${topic}`, title: `${t(`articles.topics.${topic}`)} · ${t("articles.title")}`, description: t(`articles.topicDescriptions.${topic}`) });
}

export default async function TopicPage({ params, searchParams }: PageProps<"/[locale]/articles/topic/[topic]">) {
  const { topic } = await params;
  if (!isContentTopic(topic)) notFound();
  const { t, locale } = await getT();
  const base = `/${locale}/articles/topic/${topic}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <Breadcrumbs
        items={[
          { name: t("articles.home"), path: `/${locale}` },
          { name: t("articles.title"), path: `/${locale}/articles` },
          { name: t(`articles.topics.${topic}`), path: base },
        ]}
      />
      <header className="mt-6 max-w-2xl">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t(`articles.topics.${topic}`)}</h1>
        <p className="mt-3 text-lg text-muted">{t(`articles.topicDescriptions.${topic}`)}</p>
      </header>
      <div className="mt-8">
        <ListingFilters basePath={base} type="ARTICLE" activeTopic={topic} />
      </div>
      <div className="mt-8">
        <Suspense fallback={<ListingSkeleton />}>
          <ListingResults searchParams={searchParams} type="ARTICLE" topic={topic} basePath={base} showHero={false} />
        </Suspense>
      </div>
    </div>
  );
}
