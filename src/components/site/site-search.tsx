"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Search, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import type { SiteSearchResult } from "@/server/modules/search/site-search";
import { HEADER_ICON_BUTTON } from "./nav-icons";

type Labels = { open: string; close: string; placeholder: string; empty: string; hint: string; devices: string; specs: string; products: string; articles: string };
type Hit = SiteSearchResult["devices"][number] & { pricePaise?: number };

/**
 * Header search, part of the bar itself. From `xl` it is an always-visible pill that widens on focus; below that
 * the icon turns the whole bar into a search field. Results drop down under it (Ctrl/⌘ K focuses it, Esc closes).
 */
export function SiteSearch({ locale, labels }: { locale: string; labels: Labels }) {
  const [expanded, setExpanded] = useState(false); // below xl: the bar shows the field
  const [focused, setFocused] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SiteSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const close = () => {
    setExpanded(false);
    setFocused(false);
    input.current?.blur();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setExpanded(true);
        input.current?.focus();
      } else if (e.key === "Escape") close();
    };
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setFocused(false);
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  useEffect(() => {
    if (expanded) input.current?.focus();
  }, [expanded]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return; // the hint is shown; stale results are hidden by the render check
    let alive = true;
    const handle = setTimeout(() => {
      setLoading(true);
      apiFetch<SiteSearchResult>(`/api/v1/search?q=${encodeURIComponent(term)}&locale=${locale}`, { locale })
        .then((r) => alive && setRes(r))
        .catch(() => alive && setRes(null))
        .finally(() => alive && setLoading(false));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [q, locale]);

  const groups: [string, Hit[]][] = res
    ? ([
        [labels.devices, res.devices],
        [labels.specs, res.specs],
        [labels.products, res.products],
        [labels.articles, res.articles],
      ] as [string, Hit[]][]).filter(([, hits]) => hits.length > 0)
    : [];
  const showPanel = focused;

  return (
    <div ref={root} className="xl:relative xl:flex xl:min-w-0 xl:max-w-[18rem] xl:flex-1 xl:justify-end">
      <button type="button" onClick={() => setExpanded(true)} aria-label={labels.open} title={`${labels.open} (Ctrl K)`} className={cn(HEADER_ICON_BUTTON, "xl:hidden")}>
        <Search aria-hidden className="size-5" strokeWidth={1.75} />
      </button>

      {/* The field: from xl a pill that grows leftwards over the menu on focus; below xl it covers the bar while open. */}
      <div
        className={cn(
          "items-center bg-surface xl:flex",
          expanded ? "search-bar absolute inset-0 z-10 flex gap-2 px-4 sm:inset-auto sm:top-1/2 sm:right-4 sm:w-96 sm:-translate-y-1/2 sm:pr-0 sm:pl-3 sm:shadow-[-28px_0_20px_-6px_var(--color-surface)] lg:right-6 xl:animate-none xl:shadow-none" : "hidden",
          "xl:static xl:w-full xl:translate-y-0 xl:justify-end xl:bg-transparent xl:px-0",
        )}
      >
        <label
          className={cn(
            "flex h-10 flex-1 items-center gap-2.5 rounded-full border px-4 sm:h-9 transition-[width,box-shadow,background-color,border-color] duration-300 ease-out xl:h-9 xl:flex-none",
            focused
              ? "border-foreground/20 bg-surface shadow-[0_10px_40px_-12px_rgba(0,0,0,0.28)] xl:w-full"
              : "border-border/80 bg-surface-muted/80 hover:border-foreground/20 hover:bg-surface xl:w-40",
          )}
        >
          <Search aria-hidden className={cn("size-4 shrink-0 transition-all duration-300", focused ? "scale-110 text-foreground" : "text-muted")} strokeWidth={2} />
          <span className="sr-only">{labels.open}</span>
          <input
            ref={input}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={focused || expanded ? labels.placeholder : `${labels.open}…`}
            className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent! p-0 text-sm shadow-none! outline-none! placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} aria-label={labels.close} className="hidden rounded-full p-0.5 text-muted transition hover:rotate-90 hover:text-foreground xl:inline-flex">
              <X aria-hidden className="size-4" />
            </button>
          ) : (
            <kbd className="hidden rounded-md border border-border bg-surface px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted xl:inline">Ctrl K</kbd>
          )}
        </label>
        <button
          type="button"
          onClick={() => {
            setQ("");
            close();
          }}
          aria-label={labels.close}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted transition duration-200 hover:rotate-90 hover:bg-surface-muted hover:text-foreground xl:hidden"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>

      {showPanel && (
        <div
          className="search-drop absolute inset-x-4 top-full z-50 mt-2 sm:inset-x-auto sm:right-4 sm:w-96 lg:right-6 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-surface p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] xl:inset-x-auto xl:right-0 xl:w-96"
          aria-live="polite"
        >
          {q.trim().length < 2 ? (
            <p className="px-3 py-5 text-center text-sm text-muted">{labels.hint}</p>
          ) : loading && !res ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-muted" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <p className="px-3 py-5 text-center text-sm text-muted">{labels.empty}</p>
          ) : (
            groups.map(([title, hits]) => (
              <section key={title} className="py-1">
                <h3 className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">{title}</h3>
                <ul>
                  {hits.map((h, i) => (
                    <li key={h.href} className="search-hit" style={{ "--i": i } as CSSProperties}>
                      <Link href={h.href} onClick={close} className="group/hit flex items-center gap-3 rounded-xl px-3 py-2 transition duration-200 hover:translate-x-0.5 hover:bg-surface-muted">
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                          {h.imageId ? (
                            // eslint-disable-next-line @next/next/no-img-element -- served by the media route (cached, stable URL)
                            <img src={mediaUrl(h.imageId)} alt="" loading="lazy" className="max-h-10 max-w-10 object-contain transition duration-300 group-hover/hit:scale-110" />
                          ) : (
                            <Search aria-hidden className="size-4 text-muted" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{h.title}</span>
                          {h.sub && <span className="block truncate text-xs text-muted">{h.sub}</span>}
                        </span>
                        {h.pricePaise != null && <span className="shrink-0 text-sm font-semibold">{formatPaise(h.pricePaise, locale)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}
