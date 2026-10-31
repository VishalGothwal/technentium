import type { ProductRequestStatus } from "@/generated/prisma/enums";
import type { TFunction } from "@/i18n/translate";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ORDER_STEPS, orderStepIndex } from "@/server/modules/shop/order-state";

export const ORDER_TONE: Record<ProductRequestStatus, "info" | "primary" | "success" | "danger" | "neutral" | "warning"> = {
  SUBMITTED: "warning",
  CONFIRMED: "info",
  FULFILLING: "primary",
  SHIPPED: "info",
  COMPLETED: "success",
  DECLINED: "danger",
  CANCELLED: "neutral",
};

/** Order tracking timeline (FR-PROD-07). Each reached step shows when it happened. */
export function OrderTimeline({
  status,
  history,
  t,
  locale,
}: {
  status: ProductRequestStatus;
  history: { toStatus: ProductRequestStatus; createdAt: Date }[];
  t: TFunction;
  locale: string;
}) {
  const current = orderStepIndex(status);
  const reachedAt = new Map<string, Date>();
  for (const h of history) reachedAt.set(h.toStatus, h.createdAt);
  return (
    <ol className="relative grid gap-0 sm:grid-cols-5" aria-label={t("orders.timeline")}>
      {ORDER_STEPS.map((step, i) => {
        const done = i < current || status === "COMPLETED";
        const active = i === current && status !== "COMPLETED";
        const at = reachedAt.get(step);
        return (
          <li key={step} aria-current={active ? "step" : undefined} className="relative flex gap-3 pb-5 sm:flex-col sm:pb-0">
            {i < ORDER_STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn("absolute top-8 left-[0.95rem] h-[calc(100%-2rem)] w-0.5 sm:top-[0.95rem] sm:left-8 sm:h-0.5 sm:w-[calc(100%-2rem)]", done ? "bg-primary" : "bg-border")}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-surface text-primary ring-4 ring-primary/15",
                !done && !active && "border-border bg-surface text-muted",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className="sm:pr-2">
              <span className={cn("block text-sm", active || done ? "font-semibold" : "text-muted")}>{t(`orders.status.${step}`)}</span>
              {at && (done || active) && <span className="block text-xs text-muted">{formatDateTime(at, locale)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
