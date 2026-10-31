"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { PickedDevice } from "@/components/device/device-picker";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { deviceName } from "@/lib/device-name";

export const repairModelHref = (locale: string, d: Pick<PickedDevice, "slug" | "brand" | "category">) => `/${locale}/repairs/${d.category.slug}/${d.brand.slug}/${d.slug}`;

/** Hero search: type a brand or model, pick a result to open its repair page. Results are plain links. */
export function RepairDeviceSearch({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const listId = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ q: string; items: PickedDevice[] } | null>(null);
  const term = q.trim();

  useEffect(() => {
    if (term.length < 2) return;
    let alive = true;
    const handle = setTimeout(() => {
      apiFetch<PickedDevice[]>(`/api/v1/devices/search?limit=8&q=${encodeURIComponent(term)}`, { locale })
        .then((items) => alive && setResults({ q: term, items }))
        .catch(() => alive && setResults({ q: term, items: [] }));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [term, locale]);

  const shown = term.length >= 2 && results?.q === term ? results.items : null;

  return (
    <div role="search" className={cn("relative", className)} onKeyDown={(e) => e.key === "Escape" && setQ("")}>
      <label className="relative block">
        <span className="sr-only">{t("repairFlow.searchLabel")}</span>
        <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("repairFlow.searchPlaceholder")}
          aria-controls={listId}
          autoComplete="off"
          className="h-14 w-full rounded-xl border border-border bg-surface pr-4 pl-12 text-base text-foreground shadow-lg shadow-black/10"
        />
      </label>
      {shown && (
        <ul id={listId} className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-surface p-1 text-foreground shadow-xl">
          {shown.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">{t("devicePicker.noResults")}</li>
          ) : (
            shown.map((d) => (
              <li key={d.id}>
                <Link href={repairModelHref(locale, d)} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-muted">
                  <span className="font-medium">{deviceName(d.brand.name, d.name)}</span>
                  <span className="text-xs text-muted">{locale === "hi" ? (d.category.nameHi ?? d.category.nameEn) : d.category.nameEn}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
