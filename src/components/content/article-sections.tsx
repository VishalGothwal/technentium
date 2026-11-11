import Link from "next/link";
import { getT } from "@/i18n/server";
import { CONTENT_TOPICS } from "@/lib/schemas/content";
import { cn } from "@/lib/cn";
import { getContentList, getTopicCounts } from "@/server/modules/content/content.public";
import { ArticleCard } from "./article-card";

type SP = Record<string, string | string[] | undefined>;

/** Topic accent colours (same family as the generated covers). */
const ACCENT: Record<string, string> = {
  "repair-guides": "from-teal-600 to-teal-400",
  "buying-guides": "from-indigo-700 to-indigo-400",
  protection: "from-emerald-700 to-sky-500",
  tips: "from-orange-700 to-amber-400",
  news: "from-rose-700 to-rose-400",
  "software-apps": "from-indigo-800 to-violet-500",
  photography: "from-amber-800 to-orange-500",
  gaming: "from-green-800 to-green-500",
  "laptops-tablets": "from-slate-700 to-slate-400",
  accessories: "from-pink-800 to-pink-500",
};

/**
 * Extra sections on the unfiltered Guides & articles page: topic hubs, quick fixes (short reads) and video
 * guides. Hidden while searching, filtering by tag or paging.
 */
export async function ArticleSections({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  if (sp.q || sp.tag || (sp.page && sp.page !== "1")) return null;
  const { t, locale } = await getT();
  const [counts, all, videos] = await Promise.all([
    getTopicCounts("ARTICLE"),
    getContentList(locale, { type: "ARTICLE", page: 1, pageSize: 48 }),
    getContentList(locale, { type: "VIDEO", page: 1, pageSize: 3 }),
  ]);
  const topics = CONTENT_TOPICS.filter((tp) => counts[tp]);
  const quick = all.items.filter((c) => c.readingMinutes <= 4).slice(0, 4);

  return (
    <div className="space-y-14">
      {topics.length > 0 && (
        <section aria-labelledby="browse-topics">
          <h2 id="browse-topics" className="text-2xl font-bold tracking-tight">
            {t("articles.browseTopics")}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {topics.map((tp) => (
              <li key={tp}>
                <Link href={`/${locale}/articles/topic/${tp}`} className={cn("group relative flex h-full min-h-36 flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg", ACCENT[tp] ?? "from-slate-700 to-slate-500")}>
                  <span aria-hidden className="absolute -top-6 -right-6 size-24 rounded-full bg-white/15 transition group-hover:scale-125" />
                  <span className="text-xs font-medium text-white/80">{t("articles.topicCount", { n: counts[tp] })}</span>
                  <span className="mt-0.5 font-semibold leading-tight">{t(`articles.topics.${tp}`)}</span>
                  <span className="mt-1 line-clamp-2 text-xs text-white/80">{t(`articles.topicDescriptions.${tp}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {quick.length > 0 && (
        <section aria-labelledby="quick-fixes">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="quick-fixes" className="text-2xl font-bold tracking-tight">
              {t("articles.quickFixes")}
            </h2>
            <p className="text-sm text-muted">{t("articles.quickFixesHint")}</p>
          </div>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quick.map((c) => (
              <li key={c.id}>
                <ArticleCard card={c} locale={locale} t={t} variant="compact" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {videos.items.length > 0 && (
        <section aria-labelledby="video-guides">
          <div className="flex items-end justify-between gap-4">
            <h2 id="video-guides" className="text-2xl font-bold tracking-tight">
              {t("articles.videoGuides")}
            </h2>
            <Link href={`/${locale}/videos`} className="text-sm font-medium text-primary hover:underline">
              {t("articles.allVideos")} →
            </Link>
          </div>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {videos.items.map((c) => (
              <li key={c.id}>
                <ArticleCard card={c} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="text-2xl font-bold tracking-tight">{t("articles.latest")}</h2>
    </div>
  );
}
