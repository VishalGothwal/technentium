import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { absoluteUrl, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo";
import { mediaUrl } from "@/lib/media";
import { parseVideoUrl } from "@/lib/content/video";
import { getContentDetail } from "@/server/modules/content/content.public";
import { JsonLd } from "@/components/seo/json-ld";
import { ArticleView } from "./article-view";
import { Breadcrumbs } from "./breadcrumbs";

type Type = "ARTICLE" | "VIDEO";
const segment = (type: Type) => (type === "VIDEO" ? "videos" : "articles");

/** Metadata for an article/video page. hreflang lists only locales with a published translation (FR-CMS-04). */
export async function contentDetailMetadata(type: Type, slug: string): Promise<Metadata> {
  const { locale } = await getT();
  const d = await getContentDetail(type, slug, locale);
  if (!d) notFound();
  const video = type === "VIDEO" ? parseVideoUrl(d.videoUrl) : null;
  const image = d.coverMediaId ? mediaUrl(d.coverMediaId) : (video?.thumbnailUrl ?? null);
  return pageMetadata({
    // A fallback (e.g. English shown at /hi/…) canonicalises to the language actually shown.
    locale: d.shownLocale,
    path: `/${segment(type)}/${slug}`,
    title: d.seoTitle || d.title,
    description: d.metaDescription || d.summary,
    image,
    type: type === "VIDEO" ? "video.other" : "article",
    publishedTime: d.publishedAt,
    modifiedTime: d.updatedAt,
    availableLocales: d.availableLocales,
  });
}

export async function ContentDetail({ type, slug }: { type: Type; slug: string }) {
  const { t, locale } = await getT();
  const d = await getContentDetail(type, slug, locale);
  if (!d) notFound();
  const path = `/${locale}/${segment(type)}/${slug}`;
  const url = absoluteUrl(path);
  const video = type === "VIDEO" ? parseVideoUrl(d.videoUrl) : null;
  const image = d.coverMediaId ? absoluteUrl(mediaUrl(d.coverMediaId)) : (video?.thumbnailUrl ?? undefined);
  const inLanguage = d.shownLocale === "hi" ? "hi-IN" : "en-IN";

  const structured =
    type === "VIDEO" && video
      ? {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: d.title,
          description: d.metaDescription || d.summary,
          thumbnailUrl: image ? [image] : undefined,
          uploadDate: d.publishedAt.toISOString(),
          embedUrl: video.embedUrl.replace("&autoplay=1", "").replace("?autoplay=1", ""),
          contentUrl: video.watchUrl,
          inLanguage,
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        }
      : {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: d.title,
          description: d.metaDescription || d.summary,
          image: image ? [image] : undefined,
          datePublished: d.publishedAt.toISOString(),
          dateModified: d.updatedAt.toISOString(),
          author: { "@type": "Person", name: d.authorName.replace(/\s*\(.*?\)\s*/g, "") },
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          articleSection: t(`articles.topics.${d.topic}`),
          keywords: d.tags.join(", ") || undefined,
          inLanguage,
          wordCount: undefined,
        };

  return (
    <>
      <JsonLd data={structured} />
      <ArticleView
        data={d}
        locale={locale}
        t={t}
        shareUrl={url}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { name: t("articles.home"), path: `/${locale}` },
              type === "VIDEO" ? { name: t("videos.title"), path: `/${locale}/videos` } : { name: t(`articles.topics.${d.topic}`), path: `/${locale}/articles/topic/${d.topic}` },
              { name: d.title, path },
            ]}
          />
        }
      />
    </>
  );
}

export function ArticleSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-12" aria-hidden>
      <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
      <div className="h-10 w-full animate-pulse rounded bg-surface-muted" />
      <div className="h-10 w-3/4 animate-pulse rounded bg-surface-muted" />
      <div className="mt-8 aspect-[16/8] animate-pulse rounded-3xl bg-surface-muted" />
    </div>
  );
}
