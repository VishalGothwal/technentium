"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { adjustStockAction } from "../actions";

const REASONS = [
  ["RECEIVED", "Received from supplier (+)"],
  ["RETURNED", "Customer return (+)"],
  ["DAMAGED", "Damaged / written off (−)"],
  ["ADJUSTMENT", "Stock count correction (±)"],
] as const;

/** FR-PROD-09/10: stock change with a reason; every change is kept in the movement history. */
export function StockPanel({ productId }: { productId: string }) {
  const { run, pending, error, fields } = useAction();
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("RECEIVED");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const n = Math.abs(Number(qty) || 0);
  const delta = reason === "DAMAGED" ? -n : reason === "ADJUSTMENT" ? Number(qty) || 0 : n;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setDone(null);
        run(() => adjustStockAction(productId, { delta, reason, note }), (data) => {
          setDone(`Saved. On hand is now ${(data as { onHand: number }).onHand}.`);
          setQty("");
          setNote("");
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}
      <Field label="Reason">
        {(p) => (
          <Select {...p} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
            {REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={reason === "ADJUSTMENT" ? "Change (use − to reduce)" : "Quantity"} error={fields.delta}>
        {(p) => <Input {...p} type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} required />}
      </Field>
      <Field label="Note (optional)" error={fields.note}>
        {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Invoice no., supplier, count reference" maxLength={300} />}
      </Field>
      <Button type="submit" variant="secondary" block pending={pending} disabled={!delta}>
        Record {delta > 0 ? `+${delta}` : delta || ""}
      </Button>
    </form>
  );
}
