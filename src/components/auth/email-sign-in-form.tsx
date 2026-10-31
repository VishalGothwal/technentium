"use client";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { PasswordInput } from "./password-input";

export function EmailSignInForm({ onSuccess, forgotHref }: { onSuccess: () => void; forgotHref?: string }) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setPending(true);
        setError(null);
        const res = await authClient.signIn.email({ email: String(form.get("email")).trim(), password: String(form.get("password")) });
        if (res.error) {
          setPending(false);
          const { status } = res.error;
          return setError(status === 429 ? t("auth.tooMany") : status === 403 ? t("auth.emailNotVerified") : t("auth.failed"));
        }
        onSuccess();
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label={t("auth.email")} required>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} />}
      </Field>
      <Field label={t("auth.password")} required>
        {(p) => <PasswordInput {...p} name="password" autoComplete="current-password" />}
      </Field>
      {forgotHref && (
        <div className="-mt-1 text-right">
          <Link href={forgotHref} className="text-sm font-medium text-primary hover:underline">
            {t("auth.forgot")}
          </Link>
        </div>
      )}
      <Button type="submit" block size="lg" pending={pending}>
        {t("common.signIn")}
      </Button>
    </form>
  );
}
