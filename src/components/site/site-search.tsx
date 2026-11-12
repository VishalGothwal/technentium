"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formatPaise } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import type { SiteSearchResult } from "@/server/modules/search/site-search";
import { HEADER_ICON_BUTTON } from "./nav-icons";

type Labels = { open: string; close: string; placeholder: string; empty: string; hint: string; devices: string; specs: string; products: string; articles: string };
type Hit = SiteSearchResult["devices"][number] & { pricePaise?: number };

/** Search icon in the header; opens a panel that searches phones, specs, products and articles (Ctrl/⌘ K). */
export function SiteSearch({ locale, labels }: { locale: string; labels: Labels }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SiteSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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
    }, 250);
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

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={labels.open} title={`${labels.open} (Ctrl K)`} className={HEADER_ICON_BUTTON}>
        <Search aria-hidden className="size-5" strokeWidth={1.75} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[10vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={labels.open}
            className="flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search aria-hidden className="size-5 shrink-0 text-muted" />
              <input
                ref={input}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={labels.placeholder}
                className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label={labels.close} className="rounded-full p-1.5 text-muted hover:bg-surface-muted hover:text-foreground">
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-2" aria-live="polite">
              {q.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">{labels.hint}</p>
              ) : loading && !res ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-muted" />
                  ))}
                </div>
              ) : groups.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">{labels.empty}</p>
              ) : (
                groups.map(([title, hits]) => (
                  <section key={title} className="py-1">
                    <h3 className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
                    <ul>
                      {hits.map((h) => (
                        <li key={h.href}>
                          <Link href={h.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-surface-muted">
                            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                              {h.imageId ? (
                                // eslint-disable-next-line @next/next/no-img-element -- served by the media route (redirects to signed storage URLs)
                                <img src={mediaUrl(h.imageId)} alt="" loading="lazy" className="max-h-10 max-w-10 object-contain" />
                              ) : (
                                <Search aria-hidden className="size-4 text-muted" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{h.title}</span>
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
          </div>
        </div>
      )}
    </>
  );
}
