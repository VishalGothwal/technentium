"use client";
import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { PRODUCT_SORTS } from "@/lib/schemas/shop";

/** Sort select that navigates immediately (the listing is URL-driven). */
export function SortSelect({ value, hrefFor }: { value: string; hrefFor: Record<string, string> }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted sm:inline">{t("shop.sort")}</span>
      <select
        aria-label={t("shop.sort")}
        value={value}
        onChange={(e) => router.push(hrefFor[e.target.value])}
        className="h-10 cursor-pointer rounded-md bg-transparent px-1 text-sm font-medium hover:bg-surface-muted"
      >
        {PRODUCT_SORTS.map((s) => (
          <option key={s} value={s}>
            {t(`shop.sorts.${s}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Filter sheet: a native <dialog> holding the filter links — a bottom sheet on phones, a left drawer from `sm` up. */
export function MobileFilters({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-md px-1 text-sm font-medium underline-offset-4 hover:underline"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {label}
      </button>
      <dialog
        ref={ref}
        aria-label={t("shop.filters")}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
          // Close after choosing a filter link so the results are visible.
          if ((e.target as HTMLElement).closest("a")) ref.current?.close();
        }}
        className="fixed inset-x-0 top-auto bottom-0 m-0 box-border w-full max-w-full rounded-t-3xl border border-border bg-surface p-0 text-foreground backdrop:bg-foreground/40 sm:inset-y-0 sm:right-auto sm:h-dvh sm:max-h-dvh sm:w-96 sm:rounded-none sm:border-y-0 sm:border-l-0"
      >
        <div className="max-h-[80vh] overflow-y-auto p-5 sm:max-h-none">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("shop.filters")}</h2>
            <button type="button" onClick={() => ref.current?.close()} className="rounded-lg border border-border px-3 py-1.5 text-sm" aria-label={t("shop.closeFilters")}>
              ✕
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
