"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { localized } from "@/i18n/translate";
import { cn } from "@/lib/cn";
import type { CompareGroup } from "@/lib/content/specs";
import { DevicePicker, type PickedDevice } from "@/components/device/device-picker";

export type CompareDevice = { slug: string; name: string; brand: string };

/**
 * Side-by-side spec table. Device names stay pinned while scrolling; "highlight differences"
 * tints rows whose values differ. Mobile-friendly: each row is a label line over N value cells.
 */
export function CompareTable({ devices, groups }: { devices: CompareDevice[]; groups: CompareGroup[] }) {
  const { t, locale } = useI18n();
  const [highlight, setHighlight] = useState(true);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const cols = devices.length;
  const grid = cols === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} className="size-4 accent-primary" />
          {t("compare.highlight")}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="size-4 accent-primary" />
          {t("compare.onlyDifferences")}
        </label>
      </div>
      <div className="sticky top-16 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-t-2xl sm:px-0">
        <div className={cn("grid gap-3", grid)}>
          {devices.map((d) => (
            <Link key={d.slug} href={`/${locale}/specs/${d.slug}`} className="min-w-0 rounded-xl bg-surface p-2 text-center ring-1 ring-border hover:ring-primary sm:p-3">
              <span className="block truncate text-[0.7rem] text-muted uppercase">{d.brand}</span>
              <span className="block truncate text-sm font-bold sm:text-base">{d.name}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-6">
        {groups.map((g) => {
          const rows = onlyDiff ? g.rows.filter((r) => r.differs) : g.rows;
          if (!rows.length) return null;
          return (
            <section key={g.group} className="overflow-hidden rounded-2xl border border-border bg-surface">
              <h3 className="border-b border-border bg-surface-muted/70 px-4 py-3 font-semibold">{localized(locale, g.labelEn, g.labelHi)}</h3>
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.key} className={cn("px-4 py-3 transition-colors", highlight && r.differs && "bg-warning-soft/60")}>
                    <p className="mb-1.5 flex items-center gap-2 text-xs font-medium tracking-wide text-muted uppercase">
                      {localized(locale, r.labelEn, r.labelHi)}
                      {highlight && r.differs && <span className="size-1.5 rounded-full bg-warning" aria-hidden />}
                    </p>
                    <div className={cn("grid gap-3 text-sm", grid)}>
                      {r.values.map((v, i) => (
                        <p key={i} className={cn("min-w-0 wrap-break-word", v === null ? "text-muted italic" : "font-medium")}>
                          {v ?? t("specs.notAvailable")}
                        </p>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export type CompareOption = { slug: string; modelId: string; name: string; brand: string };

/** Choose up to 3 phones with the shared DevicePicker; only phones with published specs are accepted. */
export function ComparePicker({ selected, options }: { selected: CompareDevice[]; options: CompareOption[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [adding, setAdding] = useState(selected.length < 2);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const go = (slugs: string[]) => {
    setError(null);
    start(() => router.push(slugs.length ? `/${locale}/compare?ids=${slugs.join(",")}` : `/${locale}/compare`, { scroll: false }));
  };

  const onPick = (d: PickedDevice | null) => {
    if (!d) return;
    const opt = options.find((o) => o.modelId === d.id);
    if (!opt) {
      setError(t("compare.onlyWithSpecs"));
      return;
    }
    if (selected.some((s) => s.slug === opt.slug)) return setAdding(false);
    setAdding(false);
    go([...selected.map((s) => s.slug), opt.slug].slice(0, 3));
  };

  return (
    <div className={cn("rounded-3xl border border-border bg-surface p-4 sm:p-6", pending && "opacity-70")} aria-busy={pending}>
      <ul className="grid gap-3 sm:grid-cols-3">
        {selected.map((s) => (
          <li key={s.slug} className="flex items-center justify-between gap-2 rounded-2xl bg-surface-muted p-3">
            <span className="min-w-0">
              <span className="block truncate text-xs text-muted uppercase">{s.brand}</span>
              <span className="block truncate font-semibold">{s.name}</span>
            </span>
            <button
              type="button"
              onClick={() => go(selected.filter((x) => x.slug !== s.slug).map((x) => x.slug))}
              className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-surface"
              aria-label={t("compare.remove", { name: s.name })}
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </li>
        ))}
        {selected.length < 3 && !adding && (
          <li>
            <button type="button" onClick={() => setAdding(true)} className="flex h-full min-h-16 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-3 font-medium text-muted hover:border-primary hover:text-primary">
              + {t("compare.add")}
            </button>
          </li>
        )}
      </ul>
      {selected.length >= 3 && <p className="mt-3 text-sm text-muted">{t("compare.maxDevices")}</p>}
      {adding && selected.length < 3 && (
        <div className="mt-5 border-t border-border pt-5">
          <p className="mb-3 font-semibold">{t("compare.select")}</p>
          <DevicePicker value={null} onChange={onPick} categorySlugs={PHONE_ONLY} />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-sm text-foreground">
          {error}
        </p>
      )}
    </div>
  );
}

const PHONE_ONLY = ["phone"];
