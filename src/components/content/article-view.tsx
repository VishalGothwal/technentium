import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { TFunction } from "@/i18n/translate";
import { formatDate } from "@/lib/format";
import { tableOfContents } from "@/lib/content/reading";
import type { ContentBlock } from "@/lib/schemas/content";
import type { ContentCard, ResolvedLink } from "@/server/modules/content/content.queries";
import { ArticleCard, TopicLabel } from "./article-card";
import { BlockRenderer } from "./blocks";
import { CoverArt } from "./cover-art";
import { ReadingProgress, ShareButtons, TableOfContents } from "./reading-tools";
import { VideoEmbed } from "./video-embed";

export type ArticleViewData = {
  type: "ARTICLE" | "VIDEO";
  slug: string;
  topic: string;
  tags: string[];
  title: string;
  summary: string;
  body: ContentBlock[];
  authorName: string;
  publishedAt: Date | null;
  updatedAt: Date;
  readingMinutes: number;
  coverMediaId: string | null;
  videoUrl: string | null;
  isFallback: boolean;
  shownLocale: Locale;
  explicitRelated: ResolvedLink[];
  blockLinks: ResolvedLink[];
  autoRelated: ContentCard[];
  newer: { title: string; href: string } | null;
  older: { title: string; href: string } | null;
};

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

/**
 * Long-form reading layout shared by the public article/video pages and the CMS preview.
 * Mobile: single column with a collapsible contents list. Desktop: ~68ch text column + sticky contents.
 */
export function ArticleView({ data, locale, t, shareUrl, breadcrumbs, banner }: { data: ArticleViewData; locale: Locale; t: TFunction; shareUrl: string; breadcrumbs?: ReactNode; banner?: ReactNode }) {
  const toc = tableOfContents(data.body);
  const showUpdated = data.publishedAt && data.updatedAt.getTime() - new Date(data.publishedAt).getTime() > 86_400_000;
  const relatedContent = [
    ...data.explicitRelated.filter((l) => l.targetType === "CONTENT"),
  ];
  const relatedOther = data.explicitRelated.filter((l) => l.targetType !== "CONTENT");
  const keepReading = data.autoRelated.slice(0, 3);
  const lang = data.isFallback ? data.shownLocale : undefined;

  return (
    <>
      <ReadingProgress targetId="article-body" />
      {banner}
      <article lang={lang}>
        <header className="mx-auto max-w-3xl px-4 pt-8 sm:pt-12">
          {breadcrumbs}
          {data.isFallback && (
            <p className="mt-4 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-foreground" lang={locale}>
              {t("articles.englishOnly")}
            </p>
          )}
          <Link href={`/${locale}/articles/topic/${data.topic}`} className="mt-6 inline-block">
            <TopicLabel topic={data.topic} t={t} />
          </Link>
          <h1 className="mt-3 text-[2rem] leading-[1.15] font-extrabold tracking-tight text-balance sm:text-5xl sm:leading-[1.1]">{data.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted sm:text-xl">{data.summary}</p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-border py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary" aria-hidden>
                {initials(data.authorName)}
              </span>
              <div className="text-sm">
                <p className="font-medium">{t("articles.by", { name: data.authorName.replace(/\s*\(.*?\)\s*/g, "") })}</p>
                <p className="text-muted">
                  {data.publishedAt && <time dateTime={new Date(data.publishedAt).toISOString()}>{formatDate(data.publishedAt, locale)}</time>}
                  {showUpdated && (
                    <>
                      {" · "}
                      {t("articles.updated", { date: formatDate(data.updatedAt, locale) })}
                    </>
                  )}
                  {data.type === "ARTICLE" && <> · {t("articles.readMinutes", { n: data.readingMinutes })}</>}
                </p>
              </div>
            </div>
            <ShareButtons url={shareUrl} title={data.title} />
          </div>
        </header>

        <div className="mx-auto mt-8 max-w-5xl px-4">
          {data.type === "VIDEO" && data.videoUrl ? (
            <VideoEmbed url={data.videoUrl} title={data.title} />
          ) : (
            <div className="relative aspect-[16/8] overflow-hidden rounded-3xl ring-1 ring-border">
              <CoverArt topic={data.topic} seed={data.slug} mediaId={data.coverMediaId} alt="" eager />
            </div>
          )}
        </div>

        <div className="mx-auto mt-6 grid max-w-6xl gap-10 px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,68ch)_minmax(0,1fr)]">
          <div className="hidden lg:block" />
          <div id="article-body" className="min-w-0">
            <TableOfContents entries={toc} variant="mobile" />
            <BlockRenderer blocks={data.body} locale={locale} t={t} links={data.blockLinks} />

            {data.tags.length > 0 && (
              <ul className="mt-10 flex flex-wrap gap-2" aria-label="Tags">
                {data.tags.map((tag) => (
                  <li key={tag}>
                    <Link href={`/${locale}/${data.type === "VIDEO" ? "videos" : "articles"}?tag=${tag}`} className="inline-block rounded-full bg-surface-muted px-3 py-1 text-sm text-muted hover:bg-primary-soft hover:text-primary">
                      #{tag}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {relatedOther.length > 0 && (
              <section className="mt-10 rounded-2xl border border-border bg-surface p-5" aria-labelledby="related-links-title">
                <h2 id="related-links-title" className="text-sm font-semibold tracking-wide text-muted uppercase">
                  {t("articles.relatedLinks")}
                </h2>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {relatedOther.map((l) => (
                    <li key={`${l.targetType}:${l.targetId}`}>
                      <Link href={l.href} className="group block h-full rounded-xl border border-border p-4 transition hover:border-primary hover:bg-primary-soft">
                        <span className="text-xs font-medium text-muted">{t(`articles.kinds.${l.targetType}`)}</span>
                        <span className="mt-0.5 block font-semibold group-hover:text-primary">{l.title}</span>
                        {l.summary && <span className="mt-1 line-clamp-2 block text-sm text-muted">{l.summary}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(data.newer || data.older) && (
              <nav className="mt-10 grid gap-3 sm:grid-cols-2" aria-label={`${t("articles.newer")} / ${t("articles.older")}`}>
                {data.newer ? (
                  <Link href={data.newer.href} rel="prev" className="group rounded-2xl border border-border p-4 transition hover:border-primary">
                    <span className="text-xs text-muted">← {t("articles.newer")}</span>
                    <span className="mt-1 line-clamp-2 block font-semibold group-hover:text-primary">{data.newer.title}</span>
                  </Link>
                ) : (
                  <span />
                )}
                {data.older && (
                  <Link href={data.older.href} rel="next" className="group rounded-2xl border border-border p-4 text-right transition hover:border-primary">
                    <span className="text-xs text-muted">{t("articles.older")} →</span>
                    <span className="mt-1 line-clamp-2 block font-semibold group-hover:text-primary">{data.older.title}</span>
                  </Link>
                )}
              </nav>
            )}
          </div>
          <aside className="hidden lg:block">
            <TableOfContents entries={toc} variant="desktop" />
          </aside>
        </div>
      </article>

      {(relatedContent.length > 0 || keepReading.length > 0) && (
        <section className="mt-16 border-t border-border bg-surface-muted/60 py-12" aria-labelledby="keep-reading-title">
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="keep-reading-title" className="text-2xl font-bold tracking-tight">
              {t("articles.related")}
            </h2>
            {relatedContent.length > 0 && (
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {relatedContent.map((l) => (
                  <li key={l.targetId}>
                    <Link href={l.href} className="group block h-full rounded-2xl border border-border bg-surface p-5 transition hover:border-primary">
                      <span className="font-semibold group-hover:text-primary">{l.title}</span>
                      {l.summary && <span className="mt-1 line-clamp-2 block text-sm text-muted">{l.summary}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {keepReading.length > 0 && (
              <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {keepReading.map((c) => (
                  <li key={c.id}>
                    <ArticleCard card={c} locale={locale} t={t} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </>
  );
}
