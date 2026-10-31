import Link from "next/link";
import type { TFunction } from "@/i18n/translate";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ContentCard } from "@/server/modules/content/content.queries";
import { contentPath } from "@/lib/content/paths";
import { CoverArt } from "./cover-art";

export function TopicLabel({ topic, t, className }: { topic: string; t: TFunction; className?: string }) {
  return <span className={cn("text-xs font-semibold tracking-wider text-primary uppercase", className)}>{t(`articles.topics.${topic}`)}</span>;
}

/** Article/video card. `variant="hero"` is the large featured layout on listing pages. */
export function ArticleCard({ card, locale, t, variant = "default" }: { card: ContentCard; locale: Locale; t: TFunction; variant?: "default" | "hero" | "compact" }) {
  const href = contentPath(locale, card.type, card.slug);
  const meta = (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <time dateTime={new Date(card.publishedAt).toISOString()}>{formatDate(card.publishedAt, locale)}</time>
      <span aria-hidden>·</span>
      <span>{card.type === "VIDEO" ? t("videos.watch") : t("articles.readMinutes", { n: card.readingMinutes })}</span>
      {card.isFallback && (
        <span className="rounded-full bg-surface-muted px-2 py-0.5 font-medium" lang="en">
          {t("articles.englishBadge")}
        </span>
      )}
    </p>
  );
  const lang = card.isFallback ? card.shownLocale : undefined;

  if (variant === "compact") {
    return (
      <Link href={href} className="group flex gap-3 rounded-xl p-2 transition hover:bg-surface-muted" lang={lang}>
        <span className="relative block aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg">
          <CoverArt topic={card.topic} seed={card.slug} mediaId={card.coverMediaId} />
        </span>
        <span className="min-w-0">
          <TopicLabel topic={card.topic} t={t} className="text-[0.65rem]" />
          <span className="mt-0.5 line-clamp-2 block leading-snug font-semibold group-hover:text-primary">{card.title}</span>
        </span>
      </Link>
    );
  }

  if (variant === "hero") {
    return (
      <article className="group relative grid overflow-hidden rounded-3xl border border-border bg-surface shadow-sm md:grid-cols-2" lang={lang}>
        <div className="relative aspect-[16/9] md:aspect-auto md:min-h-80">
          <CoverArt topic={card.topic} seed={card.slug} mediaId={card.coverMediaId} eager className="absolute inset-0 transition duration-500 group-hover:scale-[1.02]" />
          {card.type === "VIDEO" && <PlayBadge />}
        </div>
        <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
          <p className="flex items-center gap-2">
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">{t("articles.featured")}</span>
            <TopicLabel topic={card.topic} t={t} />
          </p>
          <h2 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
            <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {card.title}
            </Link>
          </h2>
          <p className="line-clamp-3 text-muted">{card.summary}</p>
          {meta}
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" lang={lang}>
      <div className="relative aspect-[16/9] overflow-hidden">
        <CoverArt topic={card.topic} seed={card.slug} mediaId={card.coverMediaId} className="transition duration-500 group-hover:scale-[1.03]" />
        {card.type === "VIDEO" && <PlayBadge />}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <TopicLabel topic={card.topic} t={t} />
        <h3 className="text-lg leading-snug font-semibold">
          <Link href={href} className="after:absolute after:inset-0 group-hover:text-primary focus-visible:outline-none">
            {card.title}
          </Link>
        </h3>
        <p className="line-clamp-2 flex-1 text-sm text-muted">{card.summary}</p>
        {meta}
      </div>
    </article>
  );
}

function PlayBadge() {
  return (
    <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow">
        <svg viewBox="0 0 24 24" className="ml-0.5 size-5" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}
