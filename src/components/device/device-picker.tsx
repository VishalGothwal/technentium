"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { localized } from "@/i18n/translate";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { deviceKindFor } from "@/lib/customization/style";
import { DeviceFrame } from "./device-frame";

export type PickedDevice = {
  id: string;
  slug: string;
  name: string;
  releaseYear: number | null;
  popular: boolean;
  /** 2D frame family (camera layout); see src/lib/device-frames.ts. */
  frame: string | null;
  brand: { id: string; slug: string; name: string };
  category: { id: string; slug: string; nameEn: string; nameHi: string | null };
};

type Category = { id: string; slug: string; nameEn: string; nameHi: string | null };
type Brand = { id: string; slug: string; name: string };

/**
 * Shared device selector: category chips, brand chips (once a category is chosen) and free-text search
 * across every brand and model, with a 2D outline of each device.
 * Used by protection compatibility filters, the customization studio and spec comparisons.
 */
export function DevicePicker({
  value,
  onChange,
  categorySlugs,
  className,
}: {
  value: PickedDevice | null;
  onChange: (device: PickedDevice | null) => void;
  /** Restrict to these categories (e.g. ["phone"] for customization). */
  categorySlugs?: string[];
  className?: string;
}) {
  const { t, locale } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [brands, setBrands] = useState<{ categoryId: string; items: Brand[] } | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ key: string; items: PickedDevice[] } | null>(null);

  useEffect(() => {
    let alive = true;
    apiFetch<Category[]>("/api/v1/devices/categories", { locale })
      .then((all) => alive && setCategories(categorySlugs ? all.filter((c) => categorySlugs.includes(c.slug)) : all))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [locale, categorySlugs]);

  const scopedCategoryId = categoryId ?? (categorySlugs?.length === 1 ? (categories[0]?.id ?? null) : null);
  const key = `${scopedCategoryId ?? ""}|${brand ?? ""}|${q.trim()}`;

  useEffect(() => {
    if (!scopedCategoryId) return;
    let alive = true;
    apiFetch<Brand[]>(`/api/v1/devices/brands?categoryId=${scopedCategoryId}`, { locale })
      .then((items) => alive && setBrands({ categoryId: scopedCategoryId, items }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [scopedCategoryId, locale]);
  const brandChips = scopedCategoryId && brands?.categoryId === scopedCategoryId ? brands.items : [];

  useEffect(() => {
    if (value) return;
    let alive = true;
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ limit: brand ? "60" : "24" });
      if (q.trim()) params.set("q", q.trim());
      if (brand) params.set("brand", brand);
      if (scopedCategoryId) params.set("categoryId", scopedCategoryId);
      apiFetch<PickedDevice[]>(`/api/v1/devices/search?${params}`, { locale })
        .then((items) => alive && setResults({ key, items: categorySlugs ? items.filter((d) => categorySlugs.includes(d.category.slug)) : items }))
        .catch(() => alive && setResults({ key, items: [] }));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [key, q, brand, scopedCategoryId, locale, value, categorySlugs]);

  if (value) {
    return (
      <div className={cn("flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3", className)}>
        <DeviceFrame frame={value.frame} kind={deviceKindFor(value.category.slug)} className="w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("devicePicker.selected")}</p>
          <p className="truncate font-semibold">
            {value.brand.name} {value.name}
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-muted">
          {t("devicePicker.change")}
        </button>
      </div>
    );
  }

  const loading = !results || results.key !== key;
  const items = results?.items ?? [];

  return (
    <div className={cn("space-y-3", className)}>
      {categories.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t("devicePicker.title")}>
          <Chip
            active={!categoryId}
            onClick={() => {
              setCategoryId(null);
              setBrand(null);
            }}
          >
            {t("devicePicker.all")}
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={categoryId === c.id}
              onClick={() => {
                setCategoryId(c.id);
                setBrand(null);
              }}
            >
              {localized(locale, c.nameEn, c.nameHi)}
            </Chip>
          ))}
        </div>
      )}
      {brandChips.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label={t("devicePicker.brands")}>
          <Chip small active={!brand} onClick={() => setBrand(null)}>
            {t("devicePicker.all")}
          </Chip>
          {brandChips.map((b) => (
            <Chip key={b.id} small active={brand === b.slug} onClick={() => setBrand(brand === b.slug ? null : b.slug)}>
              {b.name}
            </Chip>
          ))}
        </div>
      )}
      <label className="relative block">
        <span className="sr-only">{t("devicePicker.search")}</span>
        <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("devicePicker.search")}
          className="h-12 w-full rounded-xl border border-border bg-surface pr-3 pl-9 text-base sm:text-sm"
        />
      </label>
      <p className="text-xs font-medium uppercase tracking-wide text-muted" aria-live="polite">
        {loading ? t("devicePicker.loading") : q.trim() || brand ? t("devicePicker.results") : t("devicePicker.popular")}
      </p>
      {!loading && items.length === 0 ? (
        <p className="rounded-xl bg-surface-muted p-4 text-sm text-muted">{t("devicePicker.noResults")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onChange(d)}
                className="group flex h-full w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition hover:border-foreground"
              >
                <DeviceFrame frame={d.frame} kind={deviceKindFor(d.category.slug)} className="w-7 shrink-0 text-muted transition group-hover:text-foreground" />
                <span className="min-w-0">
                  <span className="block text-xs text-muted">
                    {d.brand.name}
                    {d.releaseYear ? ` · ${d.releaseYear}` : ""}
                  </span>
                  <span className="block leading-tight font-medium">{d.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, small, children }: { active: boolean; onClick: () => void; small?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border font-medium transition",
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}
