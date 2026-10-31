"use client";
import { track } from "@/components/site/analytics";
import Link from "next/link";
import { useState, useTransition } from "react";
import { DevicePicker, type PickedDevice } from "@/components/device/device-picker";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/cn";
import { addToCartAction, checkFitAction } from "@/app/[locale]/protection/actions";
import { MAX_LINE_QUANTITY } from "@/lib/schemas/shop";

type Fit = { state: "idle" | "checking" } | { state: "done"; compatible: boolean; universal: boolean; note: string | null };

/**
 * Product purchase panel: device fit check (FR-PROD-03), quantity, add to cart, and a sticky
 * add-to-cart bar on mobile. The chosen device is stored on the cart line so staff see what it is for.
 */
export function BuyBox({
  productId,
  name,
  pricePaise,
  universal,
  outOfStock,
}: {
  productId: string;
  name: string;
  pricePaise: number;
  universal: boolean;
  outOfStock: boolean;
}) {
  const { t, locale } = useI18n();
  const [device, setDevice] = useState<PickedDevice | null>(null);
  const [fit, setFit] = useState<Fit>({ state: "idle" });
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const chooseDevice = (d: PickedDevice | null) => {
    setDevice(d);
    setStatus(null);
    if (!d) return setFit({ state: "idle" });
    setFit({ state: "checking" });
    start(async () => {
      const res = await checkFitAction(productId, d.id);
      if (res.ok) setFit({ state: "done", ...res.data });
      else setFit({ state: "idle" });
    });
  };

  const incompatible = fit.state === "done" && !fit.compatible;
  const deviceName = device ? `${device.brand.name} ${device.name}` : "";

  const add = () => {
    setStatus(null);
    start(async () => {
      const res = await addToCartAction({ productId, deviceModelId: device && !incompatible ? device.id : null, quantity });
      if (res.ok) track("add_to_cart", { item_id: productId, quantity });
      setStatus(res.ok ? { tone: "ok", text: t("shop.added") } : { tone: "error", text: t(res.messageKey) });
    });
  };

  const addButton = (extra?: string) => (
    <Button onClick={add} pending={pending && fit.state !== "checking"} disabled={outOfStock || incompatible} size="lg" className={cn("rounded-md bg-foreground text-xs font-bold tracking-[0.12em] text-white uppercase hover:bg-foreground/85", extra)}>
      {outOfStock ? t("shop.outOfStockCta") : pending && fit.state !== "checking" ? t("shop.adding") : t("shop.addToCart")}
    </Button>
  );

  return (
    <div className="space-y-5">
      {!universal ? (
        <section aria-labelledby="fit-title" className="rounded-lg bg-surface-muted p-4">
          <h2 id="fit-title" className="mb-3 font-semibold">
            {t("shop.fitCheckTitle")}
          </h2>
          <DevicePicker value={device} onChange={chooseDevice} />
          <div aria-live="polite" className="mt-3 empty:hidden">
            {fit.state === "checking" && <p className="text-sm text-muted">{t("shop.checking")}</p>}
            {fit.state === "done" &&
              (fit.compatible ? (
                <p className="flex items-start gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">
                  <span aria-hidden>✓</span>
                  <span>
                    {t("shop.fitYes", { device: deviceName })}
                    {fit.note && <span className="block font-normal">{fit.note}</span>}
                  </span>
                </p>
              ) : (
                <p className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                  <span aria-hidden>✕</span>
                  {t("shop.fitNo", { device: deviceName })}
                </p>
              ))}
          </div>
        </section>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-sm font-medium text-success">
          <span aria-hidden>✓</span> {t("shop.fitUniversal")}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span id="qty-label" className="mb-1 block text-sm font-medium">
            {t("shop.quantity")}
          </span>
          <QuantityStepper value={quantity} onChange={setQuantity} labelledBy="qty-label" disabled={outOfStock} />
        </div>
        {addButton("flex-1 min-w-48")}
      </div>

      <div aria-live="polite" className="empty:hidden">
        {status && (
          <p className={cn("flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium", status.tone === "ok" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
            {status.text}
            {status.tone === "ok" && (
              <Link href={`/${locale}/protection/cart`} className="underline underline-offset-4">
                {t("shop.viewCart")}
              </Link>
            )}
          </p>
        )}
      </div>

      {/* Sticky bar keeps the primary action reachable on small screens. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(20,33,61,0.25)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">{name}</p>
            <p className="font-bold">{formatPaise(pricePaise * quantity, locale)}</p>
          </div>
          {addButton("h-11 px-5")}
        </div>
      </div>
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  labelledBy,
  label,
  disabled,
  max = MAX_LINE_QUANTITY,
}: {
  value: number;
  onChange: (v: number) => void;
  labelledBy?: string;
  label?: string;
  disabled?: boolean;
  max?: number;
}) {
  const { t } = useI18n();
  const btn = "flex size-11 items-center justify-center text-lg font-semibold hover:bg-surface-muted disabled:opacity-40";
  return (
    <div role="group" aria-labelledby={labelledBy} aria-label={label} className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-surface">
      <button type="button" className={btn} onClick={() => onChange(Math.max(1, value - 1))} disabled={disabled || value <= 1} aria-label={t("shop.decrease")}>
        −
      </button>
      <span className="w-10 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} aria-label={t("shop.increase")}>
        +
      </button>
    </div>
  );
}
