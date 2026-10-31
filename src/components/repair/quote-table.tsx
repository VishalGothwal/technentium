import { formatPaise } from "@/lib/format";

type Line = { id: string; kind: string; description: string; quantity: number; unitPaise: number; partGrade: string | null };
type Version = { lineItems: Line[]; subtotalPaise: number; discountPaise: number; taxPaise: number; totalPaise: number; taxRateBps: number };

/** Itemised quote with server-computed totals (shared by customer and admin views). */
export function QuoteTable({ version, locale, t }: { version: Version; locale: string; t: (k: string, p?: Record<string, string | number>) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] text-sm">
        <caption className="sr-only">{t("quote.title")}</caption>
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th scope="col" className="py-2 pr-3 font-medium">{t("quote.item")}</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">{t("quote.qty")}</th>
            <th scope="col" className="py-2 text-right font-medium">{t("quote.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {version.lineItems.map((l) => {
            const amount = l.quantity * l.unitPaise;
            return (
              <tr key={l.id} className="border-b border-border/60">
                <td className="py-2 pr-3">
                  <span className="block">{l.description}</span>
                  <span className="text-xs text-muted">
                    {t(`quote.kind.${l.kind}`)}
                    {l.partGrade ? ` · ${t("quote.grade", { grade: l.partGrade })}` : ""}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{l.quantity}</td>
                <td className="py-2 text-right tabular-nums">{l.kind === "DISCOUNT" ? `−${formatPaise(amount, locale)}` : formatPaise(amount, locale)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="tabular-nums">
          <tr>
            <th scope="row" colSpan={2} className="pt-3 pr-3 text-right font-normal text-muted">{t("quote.subtotal")}</th>
            <td className="pt-3 text-right">{formatPaise(version.subtotalPaise, locale)}</td>
          </tr>
          {version.discountPaise > 0 && (
            <tr>
              <th scope="row" colSpan={2} className="pr-3 text-right font-normal text-muted">{t("quote.discount")}</th>
              <td className="text-right">−{formatPaise(version.discountPaise, locale)}</td>
            </tr>
          )}
          <tr>
            <th scope="row" colSpan={2} className="pr-3 text-right font-normal text-muted">
              {t("quote.tax")} ({version.taxRateBps / 100}%)
            </th>
            <td className="text-right">{formatPaise(version.taxPaise, locale)}</td>
          </tr>
          <tr className="text-base font-semibold">
            <th scope="row" colSpan={2} className="pt-2 pr-3 text-right">{t("quote.total")}</th>
            <td className="pt-2 text-right">{formatPaise(version.totalPaise, locale)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
