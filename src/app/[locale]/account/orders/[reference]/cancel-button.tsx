"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/surface";
import { useI18n } from "@/i18n/client";
import { cancelOrderAction } from "@/app/[locale]/protection/actions";

export function CancelOrderButton({ reference }: { reference: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const confirm = () =>
    start(async () => {
      const res = await cancelOrderAction(reference);
      if (res.ok) setOpen(false);
      else setError(t(res.messageKey));
    });

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("orders.cancel")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("orders.cancelTitle")} description={t("orders.cancelBody")}>
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {t("orders.keep")}
          </Button>
          <Button variant="danger" onClick={confirm} pending={pending}>
            {t("orders.cancel")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
