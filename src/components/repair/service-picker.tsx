"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useI18n } from "@/i18n/client";
import { apiFetch } from "@/lib/api-client";
import { formatPaise } from "@/lib/format";
import { isValidPincode } from "@/lib/phone";
import { cn } from "@/lib/cn";
import { sumEstimates, type Estimate } from "@/lib/repair-estimates";
import { IssueIcon } from "./visuals";

export type PickerService = { id: string; slug: string; name: string; description: string | null; estimate: Estimate | null };
type Fee = { feePaise: number; waivedIfApproved: boolean } | null;

const MAX_NOTES = 500;

/**
 * Model page body: service cards with estimated prices, and a "repair list" summary with the estimated total,
 * diagnosis fee, pincode check and notes. "Book now" hands the selection to the booking wizard via the URL.
 */
export function ServicePicker({ modelId, services, initialFee }: { modelId: string; services: PickerService[]; initialFee: Fee }) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [fee, setFee] = useState<{ key: string; fee: Fee } | null>(null);

  const chosen = services.filter((s) => selected.includes(s.id));
  const total = sumEstimates(chosen.map((s) => s.estimate));
  const feeKey = selected.slice().sort().join(",");
  const currentFee = fee?.key === feeKey ? fee.fee : initialFee;

  // The diagnosis fee can depend on the chosen issues (e.g. liquid damage), so refresh it on change.
  useEffect(() => {
    if (!feeKey) return;
    let alive = true;
    apiFetch<Fee>(`/api/v1/repair/diagnosis-fee?modelId=${modelId}&issueTypeIds=${feeKey}`, { locale })
      .then((f) => alive && setFee({ key: feeKey, fee: f }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [feeKey, modelId, locale]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const params = new URLSearchParams({ model: modelId, issues: selected.join(",") });
  if (notes.trim()) params.set("notes", notes.trim().slice(0, MAX_NOTES));
  const bookHref = `/${locale}/repairs/book?${params}`;
  const range = (min: number, max: number | null) => (max ? `${formatPaise(min, locale)} – ${formatPaise(max, locale)}` : formatPaise(min, locale));

  const bookButton = (extra?: string) =>
    selected.length ? (
      <Link href={bookHref} className={cn("flex h-12 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary-hover", extra)}>
        {t("repairFlow.checkout")} <span aria-hidden>→</span>
      </Link>
    ) : (
      <span aria-disabled className={cn("flex h-12 cursor-not-allowed items-center justify-center rounded-lg bg-surface-muted font-semibold text-muted", extra)}>
        {t("repairFlow.checkout")}
      </span>
    );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="pick-title" className="min-w-0">
        <h2 id="pick-title" className="text-lg font-semibold">
          {t("repairFlow.pickServices")}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((s) => (
            <li key={s.id}>
              <ServiceCard service={s} active={selected.includes(s.id)} onToggle={() => toggle(s.id)} price={s.estimate ? range(s.estimate.minPaise, s.estimate.maxPaise) : null} />
            </li>
          ))}
        </ul>
      </section>

      <aside aria-labelledby="list-title" className="lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <h2 id="list-title" className="border-b border-border bg-surface-muted px-4 py-3 text-center font-semibold">
            {t("repairFlow.repairList")}
          </h2>
          <div className="space-y-4 p-4">
            {chosen.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted">{t("repairFlow.noneSelected")}</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {chosen.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3 py-2">
                    <span>{s.name}</span>
                    <span className="shrink-0 text-right font-medium tabular-nums">{s.estimate ? range(s.estimate.minPaise, s.estimate.maxPaise) : t("repairFlow.noEstimate")}</span>
                  </li>
                ))}
              </ul>
            )}

            <dl className="space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-semibold">{t("repairFlow.estimatedTotal")}</dt>
                <dd className="text-right text-lg font-bold tabular-nums" aria-live="polite">
                  {total.minPaise ? range(total.minPaise, total.maxPaise) : formatPaise(0, locale)}
                  {total.unpriced > 0 && <span className="block text-xs font-normal text-muted">{t("repairFlow.unpriced", { count: total.unpriced })}</span>}
                </dd>
              </div>
              {currentFee && currentFee.feePaise > 0 && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">{t("repairFlow.diagnosisFee")}</dt>
                  <dd className="text-right tabular-nums">
                    {formatPaise(currentFee.feePaise, locale)}
                    {currentFee.waivedIfApproved && <span className="block text-xs text-success">{t("repairFlow.feeWaived")}</span>}
                  </dd>
                </div>
              )}
            </dl>
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">{t("repairFlow.estimateNote")}</p>

            <PincodeCheck />

            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t("repairFlow.notesLabel")}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={MAX_NOTES}
                rows={3}
                placeholder={t("repairFlow.notesPlaceholder")}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base sm:text-sm"
              />
            </label>

            {bookButton("hidden lg:flex")}
          </div>
        </div>
      </aside>

      {/* Mobile: keep the total and the action in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(20,33,61,0.25)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{t("repairFlow.estimatedTotal")}</p>
            <p className="truncate font-bold tabular-nums">{total.minPaise ? range(total.minPaise, total.maxPaise) : t("repairFlow.noneSelected")}</p>
          </div>
          {bookButton("px-6")}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ service: s, active, onToggle, price }: { service: PickerService; active: boolean; onToggle: () => void; price: string | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const descId = useId();
  return (
    <div className={cn("flex h-full flex-col rounded-xl border bg-surface p-4 transition", active ? "border-primary ring-2 ring-primary/20" : "border-border")}>
      <div className="flex items-start gap-3">
        <IssueIcon slug={s.slug} className="size-11 shrink-0 text-foreground" />
        <div className="min-w-0">
          <h3 className="text-sm leading-snug font-bold tracking-wide uppercase">{s.name}</h3>
          {s.description && (
            <p id={descId} className={cn("mt-1 text-xs text-muted", !open && "line-clamp-2")}>
              {s.description}
            </p>
          )}
          {s.description && s.description.length > 70 && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={descId} className="text-xs font-semibold text-primary italic hover:underline">
              {open ? t("repairFlow.readLess") : t("repairFlow.readMore")}
            </button>
          )}
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 pt-4">
        <div>
          <p className="text-[0.7rem] font-medium tracking-wide text-muted uppercase">{price ? t("repairFlow.estimated") : " "}</p>
          <p className={cn("font-bold tabular-nums", price ? "text-primary" : "text-sm text-muted")}>{price ?? t("repairFlow.noEstimate")}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={active}
          aria-label={active ? t("repairFlow.removeService", { service: s.name }) : t("repairFlow.addService", { service: s.name })}
          className={cn("h-8 shrink-0 rounded-full px-4 text-xs font-bold transition", active ? "bg-primary text-white" : "border border-primary text-primary hover:bg-primary hover:text-white")}
        >
          {active ? `✓ ${t("repairFlow.added")}` : `${t("repairFlow.add")} +`}
        </button>
      </div>
    </div>
  );
}

function PincodeCheck() {
  const { t, locale } = useI18n();
  const [pin, setPin] = useState("");
  const [state, setState] = useState<{ pending?: boolean; ok?: boolean; locality?: string; error?: string } | null>(null);
  const check = async () => {
    if (!isValidPincode(pin)) return setState({ error: t("validation.pincode") });
    setState({ pending: true });
    try {
      const r = await apiFetch<{ serviceable: boolean; locality?: string }>(`/api/v1/serviceability?pincode=${pin}`, { locale });
      setState({ ok: r.serviceable, locality: r.locality });
    } catch {
      setState({ error: t("errors.generic") });
    }
  };
  return (
    <form
      className="text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        check();
      }}
    >
      <label htmlFor="pin-check" className="mb-1 block font-medium">
        {t("repairFlow.pincodeTitle")}
      </label>
      <div className="flex gap-2">
        <input
          id="pin-check"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder={t("repairFlow.pincodePlaceholder")}
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-base sm:text-sm"
        />
        <button type="submit" disabled={state?.pending} className="h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-white hover:bg-foreground/85 disabled:opacity-60">
          {t("repairFlow.check")}
        </button>
      </div>
      <p aria-live="polite" className="mt-1.5 text-xs empty:hidden">
        {state?.error && <span className="text-danger">{state.error}</span>}
        {state?.ok === true && <span className="text-success">✓ {t("repairFlow.serviceable", { locality: state.locality ?? pin })}</span>}
        {state?.ok === false && <span className="text-warning">{t("repairFlow.notServiceable")}</span>}
      </p>
    </form>
  );
}
