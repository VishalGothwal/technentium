"use client";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { cancelCustomizationAction, decideCustomizationAction, replyToCustomizationAction } from "../actions";

type Result = { ok: true } | { ok: false; messageKey: string };

function useRun() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result | { ok: true; data: unknown }>, onOk: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) onOk();
      else setError(t(res.messageKey));
    });
  return { pending, error, run };
}

export function ReplyForm({ reference }: { reference: string }) {
  const { t } = useI18n();
  const { pending, error, run } = useRun();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  if (sent) return <p className="mt-2 text-sm font-medium">{t("studio.account.replySent")}</p>;
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => replyToCustomizationAction(reference, message), () => setSent(true));
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label={t("studio.account.replyLabel")} required>
        {(p) => <Textarea {...p} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />}
      </Field>
      <Button type="submit" pending={pending} disabled={message.trim().length < 2}>
        {t("studio.account.replySend")}
      </Button>
    </form>
  );
}

export function QuoteDecision({ reference, priceLabel }: { reference: string; priceLabel: string }) {
  const { t } = useI18n();
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState<null | "accept" | "decline">(null);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<null | "accept" | "decline">(null);

  if (done) return <Alert tone={done === "accept" ? "success" : "neutral"}>{t(done === "accept" ? "studio.account.accepted" : "studio.account.declined")}</Alert>;

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={() => setOpen("accept")}>
          {t("studio.account.accept")}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => setOpen("decline")}>
          {t("studio.account.decline")}
        </Button>
      </div>
      <Dialog open={open === "accept"} onClose={() => setOpen(null)} title={t("studio.account.acceptTitle")} description={t("studio.account.acceptBody", { price: priceLabel })}>
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(null)}>
            {t("common.cancel")}
          </Button>
          <Button pending={pending} onClick={() => run(() => decideCustomizationAction(reference, "ACCEPT"), () => (setOpen(null), setDone("accept")))}>
            {t("studio.account.accept")}
          </Button>
        </div>
      </Dialog>
      <Dialog open={open === "decline"} onClose={() => setOpen(null)} title={t("studio.account.declineTitle")} description={t("studio.account.declineBody")}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label={t("studio.account.declineReason")}>
            {(p) => <Textarea {...p} className="min-h-16" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" pending={pending} onClick={() => run(() => decideCustomizationAction(reference, "DECLINE", reason), () => (setOpen(null), setDone("decline")))}>
              {t("studio.account.decline")}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function CancelButton({ reference }: { reference: string }) {
  const { t } = useI18n();
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <Alert tone="neutral">{t("studio.account.cancelled")}</Alert>;
  return (
    <>
      <Button variant="ghost" className="text-danger" onClick={() => setOpen(true)}>
        {t("studio.account.cancel")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("studio.account.cancelTitle")} description={t("studio.account.cancelBody")}>
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("common.back")}
          </Button>
          <Button variant="danger" pending={pending} onClick={() => run(() => cancelCustomizationAction(reference), () => (setOpen(false), setDone(true)))}>
            {t("studio.account.cancelConfirm")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
