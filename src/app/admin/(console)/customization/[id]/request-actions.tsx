"use client";
import { useState } from "react";
import { rupeesToPaise } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { addCustomizationNoteAction, setCustomizationNextStepsAction, shareCustomizationQuoteAction, transitionCustomizationAction } from "../actions";

const NEEDS_REASON = new Set(["NEEDS_INFO", "DECLINED", "CANCELLED"]);

export function StatusActions({ id, targets }: { id: string; targets: { value: string; label: string }[] }) {
  const { run, pending, error, fields } = useAction();
  const [to, setTo] = useState(targets[0]?.value ?? "");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  if (targets.length === 0) return <p className="text-sm text-muted">No further status changes from here.</p>;
  const needsReason = NEEDS_REASON.has(to);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => transitionCustomizationAction(id, to, reason), () => {
          setNotice("Status updated.");
          setReason("");
        });
      }}
    >
      <p className="text-sm font-medium">Change status</p>
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      <Field label="New status">
        {(p) => (
          <Select {...p} value={to} onChange={(e) => setTo(e.target.value)}>
            {targets.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={needsReason ? "Reason (shown to the customer)" : "Message to the customer (optional)"} error={fields.reason} required={needsReason}>
        {(p) => <Textarea {...p} className="min-h-20" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
      <Button type="submit" pending={pending} variant={to === "DECLINED" || to === "CANCELLED" ? "danger" : "primary"}>
        Update status
      </Button>
    </form>
  );
}

export function QuoteForm({ id, current, revising }: { id: string; current: number | null; revising: boolean }) {
  const { run, pending, error, fields } = useAction();
  const [rupees, setRupees] = useState(current != null ? String(current / 100) : "");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <form
      className="space-y-3 border-t border-border pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => shareCustomizationQuoteAction(id, rupeesToPaise(rupees) ?? -1, message), () => setNotice("Price shared with the customer."));
      }}
    >
      <p className="text-sm font-medium">{revising ? "Revise the shared price" : "Share price with the customer"}</p>
      <p className="text-xs text-muted">The customer accepts or declines it from their account. {revising && "A revision replaces the current price."}</p>
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      <Field label="Price (₹, incl. taxes)" error={fields.quotedPaise} required>
        {(p) => <Input {...p} inputMode="decimal" value={rupees} onChange={(e) => setRupees(e.target.value.replace(/[^\d.]/g, ""))} />}
      </Field>
      <Field label="Message (optional)">
        {(p) => <Textarea {...p} className="min-h-16" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />}
      </Field>
      <Button type="submit" pending={pending} disabled={!rupees}>
        {revising ? "Share revised price" : "Share price"}
      </Button>
    </form>
  );
}

export function NextStepsForm({ id, current }: { id: string; current: string }) {
  const { run, pending, error } = useAction();
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-3 border-t border-border pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setCustomizationNextStepsAction(id, value), () => setSaved(true));
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Next steps (shown to the customer)" hint="e.g. “Bring your phone to the shop on Saturday for fitting.”">
        {(p) => <Textarea {...p} className="min-h-16" maxLength={1000} value={value} onChange={(e) => (setValue(e.target.value), setSaved(false))} />}
      </Field>
      <Button type="submit" variant="secondary" pending={pending}>
        {saved ? "Saved" : "Save next steps"}
      </Button>
    </form>
  );
}

export function NoteForm({ id, allowCustomer }: { id: string; allowCustomer: boolean }) {
  const { run, pending, error, fields } = useAction();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"INTERNAL" | "CUSTOMER">("INTERNAL");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addCustomizationNoteAction(id, body, visibility), () => setBody(""));
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Add a note" error={fields.body}>
        {(p) => <Textarea {...p} className="min-h-16" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />}
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {allowCustomer ? (
          <fieldset className="flex gap-4 text-sm">
            <legend className="sr-only">Visibility</legend>
            {(["INTERNAL", "CUSTOMER"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="visibility" checked={visibility === v} onChange={() => setVisibility(v)} className="accent-[var(--primary)]" />
                {v === "INTERNAL" ? "Internal" : "Visible to customer"}
              </label>
            ))}
          </fieldset>
        ) : (
          <span className="text-xs text-muted">Internal note</span>
        )}
        <Button type="submit" size="sm" pending={pending} disabled={!body.trim()}>
          Add note
        </Button>
      </div>
    </form>
  );
}
