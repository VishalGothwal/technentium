"use client";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { formatPaise } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { cancelBookingAction, decideQuoteAction, replyToInfoRequestAction } from "../../actions";

type Charges = { diagnosisFeePaise: number; collectionPaise: number; deliveryPaise: number };
type Address = { addressLine1: string; addressLine2: string; pincode: string };

export function QuoteDecision({ versionId, totalLabel, charges, defaultAddress }: { versionId: string; totalLabel: string; charges: Charges; defaultAddress: Address | null }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<null | "approve" | "decline">(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<"COLLECTION" | "DELIVERY">(defaultAddress ? "DELIVERY" : "COLLECTION");
  const [address, setAddress] = useState<Address>(defaultAddress ?? { addressLine1: "", addressLine2: "", pincode: "" });
  const [reason, setReason] = useState("");
  const [accept, setAccept] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const returnCharge = method === "DELIVERY" ? charges.deliveryPaise : charges.collectionPaise;
  const money = (p: number) => (p === 0 ? t("quote.free") : formatPaise(p, locale));

  const run = (input: unknown, success: string) =>
    start(async () => {
      setError(null);
      const res = await decideQuoteAction(versionId, input);
      if (res.ok) {
        setOpen(null);
        setDone(success);
      } else {
        setError(t(res.messageKey));
        setFields(Object.fromEntries(Object.entries(res.fields ?? {}).map(([k, v]) => [k, t(v)])));
      }
    });

  if (done) return <Alert tone="success">{done}</Alert>;

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={() => setOpen("approve")}>
          {t("quote.approve")}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => setOpen("decline")}>
          {t("quote.decline")}
        </Button>
      </div>

      <Dialog open={open === "approve"} onClose={() => setOpen(null)} title={t("quote.approveTitle")} description={t("quote.approveBody", { total: totalLabel })}>
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(null)}>
            {t("common.cancel")}
          </Button>
          <Button pending={pending} onClick={() => run({ decision: "APPROVED" }, t("quote.approved"))}>
            {t("quote.approveConfirm")}
          </Button>
        </div>
      </Dialog>

      <Dialog open={open === "decline"} onClose={() => setOpen(null)} title={t("quote.declineTitle")} description={t("quote.declineBody")}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("quote.returnMethod")}</legend>
            <div className="space-y-2">
              {(["COLLECTION", "DELIVERY"] as const).map((m) => (
                <label key={m} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                  <input type="radio" name="returnMethod" checked={method === m} onChange={() => setMethod(m)} className="accent-[var(--primary)]" />
                  <span className="flex-1">{m === "COLLECTION" ? t("quote.collect") : t("quote.deliver")}</span>
                  <span className="text-muted">{money(m === "DELIVERY" ? charges.deliveryPaise : charges.collectionPaise)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {method === "DELIVERY" && (
            <div className="space-y-3">
              <Field label={t("booking.addressLine1")} error={fields["address.addressLine1"] ?? fields.address} required>
                {(p) => <Input {...p} value={address.addressLine1} onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })} />}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("booking.addressLine2")}>
                  {(p) => <Input {...p} value={address.addressLine2} onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })} />}
                </Field>
                <Field label={t("booking.pincode")} error={fields["address.pincode"]} required>
                  {(p) => <Input {...p} inputMode="numeric" maxLength={6} value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value.replace(/\D/g, "") })} />}
                </Field>
              </div>
            </div>
          )}
          <div className="rounded-lg bg-surface-muted p-3 text-sm">
            <p className="mb-2 font-medium">{t("quote.charges")}</p>
            <dl className="space-y-1">
              <div className="flex justify-between">
                <dt>{t("quote.diagnosisCharge")}</dt>
                <dd className="tabular-nums">{money(charges.diagnosisFeePaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t("quote.returnCharge")}</dt>
                <dd className="tabular-nums">{money(returnCharge)}</dd>
              </div>
            </dl>
          </div>
          <Field label={t("quote.reasonLabel")}>
            {(p) => <Textarea {...p} className="min-h-16" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <Checkbox checked={accept} onChange={(e) => setAccept(e.target.checked)} label={t("quote.acceptCharges")} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              pending={pending}
              disabled={!accept}
              onClick={() =>
                run(
                  { decision: "DECLINED", returnMethod: method, reason, acceptCharges: accept, address: method === "DELIVERY" ? address : undefined },
                  t("quote.declined"),
                )
              }
            >
              {t("quote.declineConfirm")}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function CancelBookingButton({ reference }: { reference: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t("tracking.cancel")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("tracking.cancel")} description={t("tracking.cancelConfirm")}>
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("common.back")}
          </Button>
          <Button
            variant="danger"
            pending={pending}
            onClick={() =>
              start(async () => {
                const res = await cancelBookingAction(reference);
                if (res.ok) setOpen(false);
                else setError(t(res.messageKey));
              })
            }
          >
            {t("tracking.cancel")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function InfoReplyForm({ reference }: { reference: string }) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  if (result?.ok) return <p className="mt-2 font-medium">{result.text}</p>;
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await replyToInfoRequestAction(reference, message);
          setResult(res.ok ? { ok: true, text: t("tracking.replySent") } : { ok: false, text: t(res.fields?._ ?? res.messageKey) });
        });
      }}
    >
      <Field label={t("tracking.reply")} error={result && !result.ok ? result.text : undefined} required>
        {(p) => <Textarea {...p} value={message} onChange={(e) => setMessage(e.target.value)} className="bg-surface" />}
      </Field>
      <Button type="submit" size="sm" pending={pending}>
        {t("tracking.sendReply")}
      </Button>
    </form>
  );
}
