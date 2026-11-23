import type { TFunction } from "@/i18n/translate";
import { cn } from "@/lib/cn";

const STEPS = ["pickup", "diagnose", "repair", "return"] as const;

/** The four repair steps (no section heading). */
export function RepairProcess({ t, className }: { t: TFunction; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border bg-surface", className)}>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:grid-cols-4 sm:p-6">
        {STEPS.map((s, i) => (
          <li key={s} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-primary-foreground">{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold sm:text-base">{t(`site.journey.${s}.title`)}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted sm:text-sm">{t(`site.journey.${s}.body`)}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Titled section: "How it works" with the four steps. */
export function RepairJourney({ t, title, className }: { t: TFunction; title?: string; className?: string }) {
  return (
    <section className={cn("mx-auto mt-16 max-w-6xl px-4", className)} aria-labelledby="journey-title">
      <h2 id="journey-title" className="text-center text-2xl font-bold tracking-tight">
        {title ?? t("repairFlow.howTitle")}
      </h2>
      <span aria-hidden className="mx-auto mt-2 block h-1 w-12 rounded-full bg-primary" />
      <RepairProcess t={t} className="mt-8" />
    </section>
  );
}
