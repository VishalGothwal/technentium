"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import type { TocEntry } from "@/lib/content/reading";

function subscribeScroll(cb: () => void) {
  window.addEventListener("scroll", cb, { passive: true });
  window.addEventListener("resize", cb);
  return () => {
    window.removeEventListener("scroll", cb);
    window.removeEventListener("resize", cb);
  };
}

/** Thin progress bar under the site header, based on how far the article body has been read. */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const { t } = useI18n();
  const progress = useSyncExternalStore(
    subscribeScroll,
    () => {
      const el = document.getElementById(targetId);
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.6;
      return Math.round(Math.min(1, Math.max(0, -rect.top / Math.max(total, 1))) * 100);
    },
    () => 0,
  );
  return (
    <div className="fixed inset-x-0 top-0 z-40 h-1 bg-transparent" role="progressbar" aria-label={t("articles.readingProgress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
      <div className="h-full origin-left bg-gradient-to-r from-primary to-accent transition-[width] duration-150" style={{ width: `${progress}%` }} />
    </div>
  );
}

/** Table of contents: collapsible on mobile, sticky with active-section highlight on desktop. */
export function TableOfContents({ entries, variant }: { entries: TocEntry[]; variant: "mobile" | "desktop" }) {
  const { t } = useI18n();
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (variant !== "desktop" || entries.length === 0) return;
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records.filter((r) => r.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    for (const e of entries) {
      const el = document.getElementById(e.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [entries, variant]);

  if (entries.length < 2) return null;
  const list = (
    <ol className="space-y-1 text-sm">
      {entries.map((e) => (
        <li key={e.id} className={e.level === 3 ? "pl-4" : ""}>
          <a
            href={`#${e.id}`}
            aria-current={active === e.id ? "location" : undefined}
            className={cn(
              "block rounded-md border-l-2 py-1 pr-2 pl-3 transition",
              active === e.id ? "border-primary bg-primary-soft font-medium text-primary" : "border-transparent text-muted hover:border-border hover:text-foreground",
            )}
          >
            {e.text}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "mobile") {
    return (
      <details className="group my-6 rounded-2xl border border-border bg-surface lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
          {t("articles.onThisPage")}
          <svg viewBox="0 0 24 24" className="size-4 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <nav aria-label={t("articles.onThisPage")} className="border-t border-border px-2 py-3">
          {list}
        </nav>
      </details>
    );
  }
  return (
    <nav aria-label={t("articles.onThisPage")} className="sticky top-24">
      <p className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">{t("articles.onThisPage")}</p>
      {list}
    </nav>
  );
}

/** Copy link + WhatsApp share (the most common sharing channel for our customers). */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
  return (
    <div className="flex items-center gap-2">
      <span className="sr-only">{t("articles.share")}</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt(t("articles.copyLink"), url);
          }
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-muted"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </svg>
        <span aria-live="polite">{copied ? t("articles.copied") : t("articles.copyLink")}</span>
      </button>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1f8f4e] px-3 text-sm font-medium text-white hover:bg-[#187a41]"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.1z" />
        </svg>
        {t("articles.shareWhatsApp")}
      </a>
    </div>
  );
}
