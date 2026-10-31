import Link from "next/link";
import type { TFunction } from "@/i18n/translate";
import type { Locale } from "@/i18n/config";
import { headingId } from "@/lib/content/reading";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/cn";
import type { ContentBlock } from "@/lib/schemas/content";
import type { ResolvedLink } from "@/server/modules/content/content.queries";
import { Inline } from "./inline";
import { VideoEmbed } from "./video-embed";

const CALLOUT_STYLES = {
  tip: { box: "border-success/30 bg-success-soft", icon: "text-success", path: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" },
  warning: { box: "border-warning/30 bg-warning-soft", icon: "text-warning", path: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" },
  info: { box: "border-info/30 bg-info-soft", icon: "text-info", path: "M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" },
} as const;

const CTA_HREF = { repair: "/repairs/book", protection: "/protection", customize: "/customize", specs: "/compare" } as const;

/**
 * Editorial block renderer for articles (FR-CMS-02). Typography is tuned for long-form reading:
 * ~68ch measure, generous leading (taller for Devanagari), clear heading rhythm.
 */
export function BlockRenderer({ blocks, locale, t, links = [] }: { blocks: ContentBlock[]; locale: Locale; t: TFunction; links?: ResolvedLink[] }) {
  const used = new Map<string, number>();
  const leading = locale === "hi" ? "leading-[1.9]" : "leading-[1.75]";
  const linkFor = (type: string, id: string) => links.find((l) => l.targetType === type && l.targetId === id);

  return (
    <div className={cn("text-[1.0625rem] text-foreground/90 sm:text-[1.125rem]", leading)}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            const id = headingId(b.text, used);
            const H = b.level === 2 ? "h2" : "h3";
            return (
              <H
                key={i}
                id={id}
                className={cn(
                  "group scroll-mt-24 font-bold tracking-tight text-foreground",
                  b.level === 2 ? "mt-12 mb-4 text-[1.5rem] leading-snug sm:text-[1.75rem]" : "mt-8 mb-3 text-[1.2rem] leading-snug sm:text-[1.3rem]",
                )}
              >
                <Inline text={b.text} />
                <a href={`#${id}`} className="ml-2 text-muted opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label={`#${id}`}>
                  #
                </a>
              </H>
            );
          }
          case "paragraph":
            return (
              <p key={i} className="my-5">
                <Inline text={b.text} />
              </p>
            );
          case "list": {
            const L = b.style === "number" ? "ol" : "ul";
            return (
              <L key={i} className={cn("my-5 space-y-2 pl-6", b.style === "number" ? "list-decimal marker:font-semibold marker:text-primary" : "list-disc marker:text-primary")}>
                {b.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    <Inline text={item} />
                  </li>
                ))}
              </L>
            );
          }
          case "quote":
            return (
              <figure key={i} className="my-8 border-l-4 border-primary pl-5">
                <blockquote className="text-[1.15em] font-medium text-foreground italic">
                  <Inline text={b.text} />
                </blockquote>
                {b.cite && <figcaption className="mt-2 text-sm text-muted not-italic">— {b.cite}</figcaption>}
              </figure>
            );
          case "image":
            return (
              <figure key={i} className="my-8">
                {/* eslint-disable-next-line @next/next/no-img-element -- media route serves re-encoded WebP */}
                <img src={mediaUrl(b.mediaId)} alt={b.alt} loading="lazy" className="w-full rounded-2xl bg-surface-muted object-cover ring-1 ring-border" />
                {b.caption && (
                  <figcaption className="mt-2 text-center text-sm text-muted">
                    <Inline text={b.caption} />
                  </figcaption>
                )}
              </figure>
            );
          case "video":
            return (
              <div key={i} className="my-8">
                <VideoEmbed url={b.url} title={b.title || t("videos.title")} />
                {b.title && <p className="mt-2 text-center text-sm text-muted">{b.title}</p>}
              </div>
            );
          case "callout": {
            const s = CALLOUT_STYLES[b.tone];
            return (
              <aside key={i} className={cn("my-8 flex gap-3 rounded-2xl border p-4 sm:p-5", s.box)} role="note">
                <svg viewBox="0 0 24 24" className={cn("mt-1 size-5 shrink-0", s.icon)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={s.path} />
                </svg>
                <div className="text-[0.95em]">
                  <p className="font-semibold text-foreground">{b.title || t(`articles.callout.${b.tone}`)}</p>
                  <p className="mt-1">
                    <Inline text={b.text} />
                  </p>
                </div>
              </aside>
            );
          }
          case "cta":
            return (
              <aside key={i} className="not-prose my-10 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground shadow-sm sm:p-7">
                <p className="text-xl font-bold">{b.title || t(`articles.cta.${b.kind}.title`)}</p>
                <p className="mt-2 text-[0.95em] leading-relaxed opacity-90">{b.text || t(`articles.cta.${b.kind}.text`)}</p>
                <Link href={`/${locale}${CTA_HREF[b.kind]}`} className="mt-4 inline-flex h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold text-primary transition hover:bg-white/90">
                  {t(`articles.cta.${b.kind}.button`)} →
                </Link>
              </aside>
            );
          case "related": {
            const resolved = b.items.map((it) => linkFor(it.targetType, it.targetId)).filter((l): l is ResolvedLink => !!l);
            if (!resolved.length) return null;
            return (
              <aside key={i} className="my-8 rounded-2xl border border-border bg-surface p-5">
                <p className="text-sm font-semibold tracking-wide text-muted uppercase">{b.title || t("articles.related")}</p>
                <ul className="mt-3 divide-y divide-border">
                  {resolved.map((l) => (
                    <li key={`${l.targetType}:${l.targetId}`}>
                      <Link href={l.href} className="group flex items-center justify-between gap-3 py-3">
                        <span>
                          <span className="block text-xs text-muted">{t(`articles.kinds.${l.targetType}`)}</span>
                          <span className="font-medium text-foreground group-hover:text-primary">{l.title}</span>
                        </span>
                        <span aria-hidden className="text-muted transition group-hover:translate-x-0.5 group-hover:text-primary">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </aside>
            );
          }
        }
      })}
    </div>
  );
}
