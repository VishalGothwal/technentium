"use client";
import { useMemo, useState } from "react";
import { computeTotals, type MoneyLine } from "@/server/modules/quotes/money";
import { formatPaise, rupeesToPaise } from "@/lib/format";
import { LINE_ITEM_KINDS } from "@/lib/schemas/repair";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { openDraftAction, saveDraftAction, sendQuoteAction } from "@/app/admin/actions";

type Kind = (typeof LINE_ITEM_KINDS)[number];

export type DraftLine = {
  kind: Kind;
  description: string;
  quantity: number;
  unitPaise: number;
  taxable: boolean;
  priceItemId: string | null;
  partGrade: string | null;
  compatibilityNote: string | null;
};

export type PriceItemOption = { id: string; kind: Kind; name: string; unitPaise: number; partGrade: string | null };

type Row = Omit<DraftLine, "unitPaise" | "quantity"> & { key: string; unit: string; qty: string };

const toRow = (l: DraftLine): Row => ({
  ...l,
  key: crypto.randomUUID(),
  unit: (l.unitPaise / 100).toFixed(l.unitPaise % 100 === 0 ? 0 : 2),
  qty: String(l.quantity),
});

const cell = "h-9 w-full rounded-md border border-border bg-surface px-2 text-sm";

/** "Prepare quote" / "Revise quote" — opening a draft over a sent quote supersedes it (needs fresh approval). */
export function OpenDraftButton({ jobId, revise }: { jobId: string; revise: boolean }) {
  const { run, pending, error } = useAction();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-2">
      <Button size="sm" variant={revise ? "secondary" : "primary"} pending={pending} onClick={() => (revise ? setConfirm(true) : run(() => openDraftAction(jobId)))}>
        {revise ? "Revise quote" : "Prepare quote"}
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Revise this quote?"
        description="A new draft version is created from the current lines. The sent version is withdrawn and the customer must approve the new version before work continues."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button pending={pending} onClick={() => run(() => openDraftAction(jobId), () => setConfirm(false))}>
            Create revision
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function QuoteEditor({
  versionId,
  number,
  taxRateBps,
  initialLines,
  initialMessage,
  priceItems,
  hasDiagnosis,
}: {
  versionId: string;
  number: number;
  taxRateBps: number;
  initialLines: DraftLine[];
  initialMessage: string;
  priceItems: PriceItemOption[];
  hasDiagnosis: boolean;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>(() => initialLines.map(toRow));
  const [message, setMessage] = useState(initialMessage);
  const [dirty, setDirty] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const save = useAction();
  const send = useAction();

  const edit = (key: string, patch: Partial<Row>) => {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const parsed = useMemo(
    () =>
      rows.map((r) => ({
        row: r,
        unitPaise: rupeesToPaise(r.unit),
        quantity: /^\d+$/.test(r.qty) ? Number(r.qty) : NaN,
      })),
    [rows],
  );
  const invalid = parsed.some((p) => p.unitPaise === null || !(p.quantity >= 1 && p.quantity <= 100) || p.row.description.trim().length < 2);

  const preview = useMemo(() => {
    if (invalid) return null;
    try {
      return computeTotals(
        parsed.map<MoneyLine>((p) => ({ kind: p.row.kind, quantity: p.quantity, unitPaise: p.unitPaise!, taxable: p.row.taxable })),
        taxRateBps,
      );
    } catch {
      return "discount" as const;
    }
  }, [parsed, invalid, taxRateBps]);

  function payload() {
    return {
      customerMessage: message,
      lines: parsed.map((p) => ({
        kind: p.row.kind,
        description: p.row.description.trim(),
        quantity: p.quantity,
        unitPaise: p.unitPaise,
        taxable: p.row.taxable,
        priceItemId: p.row.priceItemId,
        partGrade: p.row.partGrade || null,
        compatibilityNote: p.row.compatibilityNote || null,
      })),
    };
  }

  function onSave(after?: () => void) {
    setLocalError(null);
    if (invalid) return setLocalError("Each line needs a description, a quantity of 1–100 and a valid price (e.g. 1499 or 1499.50).");
    if (preview === "discount") return setLocalError(t("errors.quote.discountTooLarge"));
    save.run(() => saveDraftAction(versionId, payload()), () => {
      setDirty(false);
      after?.();
    });
  }

  const addRow = (line: Partial<DraftLine> = {}) => {
    setRows([
      ...rows,
      toRow({ kind: "LABOUR", description: "", quantity: 1, unitPaise: 0, taxable: true, priceItemId: null, partGrade: null, compatibilityNote: null, ...line }),
    ]);
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Draft — version {number}</p>
        {dirty && <span className="text-xs text-warning">Unsaved changes</span>}
      </div>

      {(localError || save.error) && <Alert tone="danger">{localError ?? save.error}</Alert>}

      <div className="space-y-3">
        {rows.map((r, i) => (
          <fieldset key={r.key} className="rounded-lg border border-border p-3">
            <legend className="px-1 text-xs text-muted">Line {i + 1}</legend>
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr_4.5rem_7rem]">
              <label className="text-xs text-muted">
                Type
                <select className={cell} value={r.kind} onChange={(e) => edit(r.key, { kind: e.target.value as Kind })}>
                  {LINE_ITEM_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`quote.kind.${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Description
                <input className={cell} value={r.description} onChange={(e) => edit(r.key, { description: e.target.value })} maxLength={200} />
              </label>
              <label className="text-xs text-muted">
                Qty
                <input className={cell} inputMode="numeric" value={r.qty} onChange={(e) => edit(r.key, { qty: e.target.value.replace(/\D/g, "") })} />
              </label>
              <label className="text-xs text-muted">
                Unit price (₹)
                <input
                  className={cell}
                  inputMode="decimal"
                  value={r.unit}
                  aria-invalid={rupeesToPaise(r.unit) === null || undefined}
                  onChange={(e) => edit(r.key, { unit: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
              <label className="text-xs text-muted">
                Part grade
                <input className={cell} value={r.partGrade ?? ""} onChange={(e) => edit(r.key, { partGrade: e.target.value })} placeholder="original / compatible" />
              </label>
              <label className="text-xs text-muted">
                Compatibility note
                <input className={cell} value={r.compatibilityNote ?? ""} onChange={(e) => edit(r.key, { compatibilityNote: e.target.value })} />
              </label>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input type="checkbox" checked={r.taxable} onChange={(e) => edit(r.key, { taxable: e.target.checked })} className="accent-[var(--primary)]" />
                Taxable
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRows(rows.filter((x) => x.key !== r.key));
                  setDirty(true);
                }}
              >
                Remove
              </Button>
            </div>
          </fieldset>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">No lines yet. Add a line or pick from the price list.</p>}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => addRow()}>
          Add line
        </Button>
        {priceItems.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            <span className="sr-only">Add from price list</span>
            <select
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              value=""
              onChange={(e) => {
                const item = priceItems.find((p) => p.id === e.target.value);
                if (item) addRow({ kind: item.kind, description: item.name, unitPaise: item.unitPaise, priceItemId: item.id, partGrade: item.partGrade });
              }}
            >
              <option value="">Add from price list…</option>
              {priceItems.map((p) => (
                <option key={p.id} value={p.id}>
                  {t(`quote.kind.${p.kind}`)} · {p.name} · {formatPaise(p.unitPaise)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="rounded-lg bg-surface-muted p-3 text-sm" aria-live="polite">
        {preview === null ? (
          <p className="text-muted">Totals appear when every line is valid.</p>
        ) : preview === "discount" ? (
          <p className="text-danger">{t("errors.quote.discountTooLarge")}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-y-1 tabular-nums">
            <dt className="text-muted">Subtotal</dt>
            <dd className="text-right">{formatPaise(preview.subtotalPaise)}</dd>
            {preview.discountPaise > 0 && (
              <>
                <dt className="text-muted">Discount</dt>
                <dd className="text-right">−{formatPaise(preview.discountPaise)}</dd>
              </>
            )}
            <dt className="text-muted">GST ({taxRateBps / 100}%)</dt>
            <dd className="text-right">{formatPaise(preview.taxPaise)}</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="text-right font-semibold">{formatPaise(preview.totalPaise)}</dd>
          </dl>
        )}
        <p className="mt-2 text-xs text-muted">Preview only — the server recalculates and stores the final totals.</p>
      </div>

      <Field label="Message to customer" hint="Shown above the quote on the customer's booking page.">
        {(p) => (
          <Textarea
            {...p}
            className="min-h-16"
            maxLength={1000}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setDirty(true);
            }}
          />
        )}
      </Field>

      {!hasDiagnosis && <Alert tone="warning">Record the diagnosis before sending the quote.</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" pending={save.pending} onClick={() => onSave()}>
          Save draft
        </Button>
        <Button type="button" disabled={!hasDiagnosis || rows.length === 0} onClick={() => (dirty ? onSave(() => setConfirmSend(true)) : setConfirmSend(true))}>
          Send to customer
        </Button>
      </div>

      <Dialog
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        title={`Send quote version ${number}?`}
        description="The customer is notified and must approve this quote before any repair work starts. Once sent, this version can't be edited — changes need a revision."
      >
        {send.error && <Alert tone="danger" className="mb-3">{send.error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmSend(false)}>
            Cancel
          </Button>
          <Button pending={send.pending} onClick={() => send.run(() => sendQuoteAction(versionId), () => setConfirmSend(false))}>
            Send quote
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
