"use client";
import { useState } from "react";
import { requestPasswordResetAction } from "../actions";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";

export function ForgotForm() {
  const { t, locale } = useI18n();
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The same message is shown whether or not the account exists (no account enumeration).
  if (sent) return <Alert tone="success">{t("auth.linkSent")}</Alert>;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const res = await requestPasswordResetAction(String(new FormData(e.currentTarget).get("email")), locale);
        setPending(false);
        if (!res.ok) return setError(t(res.error));
        setSent(true);
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label={t("auth.email")} required>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" />}
      </Field>
      <Button type="submit" block pending={pending}>
        {t("auth.sendLink")}
      </Button>
    </form>
  );
}
