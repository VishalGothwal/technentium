"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { localized } from "@/i18n/translate";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/cn";
import { removeCartItemAction, updateCartItemAction } from "@/app/[locale]/protection/actions";
import { QuantityStepper } from "./buy-box";
import { ProductVisual } from "./product-visual";

type Line = {
  id: string;
  slug: string;
  nameEn: string;
  nameHi: string | null;
  categorySlug: string;
  imageId: string | null;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
  device: { name: string } | null;
  available: boolean;
};

/** Editable cart lines. Each change is a Server Action; the page re-renders totals from the server. */
export function CartLines({ items }: { items: Line[] }) {
  const { t, locale } = useI18n();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const act = (id: string, fn: () => Promise<{ ok: boolean; messageKey?: string }>) => {
    setBusyId(id);
    start(async () => {
      const res = await fn();
      setMessage(res.ok ? t("cart.updated") : t(res.messageKey ?? "errors.generic"));
      setBusyId(null);
    });
  };

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {message}
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
        {items.map((item) => {
          const name = localized(locale, item.nameEn, item.nameHi);
          const busy = pending && busyId === item.id;
          return (
            <li key={item.id} className={cn("flex gap-4 p-4 transition", busy && "opacity-60")} aria-busy={busy}>
              <Link href={`/${locale}/protection/${item.slug}`} className="size-20 shrink-0 overflow-hidden rounded-2xl bg-surface-muted sm:size-24" tabIndex={-1} aria-hidden>
                <ProductVisual imageId={item.imageId} categorySlug={item.categorySlug} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/${locale}/protection/${item.slug}`} className="line-clamp-2 font-semibold hover:underline">
                      {name}
                    </Link>
                    {item.device && <p className="text-xs text-muted">{t("shop.forDevice", { device: item.device.name })}</p>}
                    <p className="text-sm text-muted">{formatPaise(item.unitPricePaise, locale)}</p>
                  </div>
                  <p className="shrink-0 font-bold">{formatPaise(item.lineTotalPaise, locale)}</p>
                </div>
                {!item.available && <p className="text-sm font-medium text-danger">{t("cart.unavailable")}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {item.available ? (
                    <QuantityStepper
                      value={item.quantity}
                      label={t("cart.quantityFor", { name })}
                      disabled={busy}
                      onChange={(q) => act(item.id, () => updateCartItemAction(item.id, q))}
                    />
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => act(item.id, () => removeCartItemAction(item.id))}
                    disabled={busy}
                    className="rounded-lg px-2 py-1 text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline"
                    aria-label={t("cart.removeItem", { name })}
                  >
                    {t("cart.remove")}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
