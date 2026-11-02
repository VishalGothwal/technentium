"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { setNewPasswordAction } from "../actions";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input";

export function ResetForm() {
  const { t, locale } = useI18n();
  const params = useSearchParams();
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  // The reset link opens a short-lived session through /api/auth/callback before landing here.
  if (params.get("error")) return <Alert tone="danger">{t("auth.resetInvalid")}</Alert>;
  if (done)
    return (
      <Alert tone="success">
        {t("auth.resetDone")}{" "}
        <Link className="underline" href={`/${locale}/auth/sign-in`}>
          {t("common.signIn")}
        </Link>
      </Alert>
    );

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const newPassword = password;
        if (newPassword.length < 8) return setError(t("auth.passwordHint"));
        setPending(true);
        const res = await setNewPasswordAction(newPassword);
        setPending(false);
        if (!res.ok) return setError(t(res.error));
        setDone(true);
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label={t("auth.newPassword")} hint={t("auth.passwordHint")} required>
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <PasswordStrength password={password} />
      <Button type="submit" block size="lg" pending={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}
