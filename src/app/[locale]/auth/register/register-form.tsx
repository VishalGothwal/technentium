"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { safeNext } from "@/lib/safe-redirect";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input";
import { recordConsent, signUpWithPasswordAction } from "../actions";

export function RegisterForm() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"), `/${locale}/account`);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; password?: string }>({});
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  const [before, after] = t("auth.consent").split("{terms}");
  const [mid, end] = (after ?? "").split("{privacy}");

  // Supabase sends a confirmation link; the account opens when it is followed.
  if (checkEmail) return <Alert tone="success">{t("auth.checkEmail")}</Alert>;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const name = String(form.get("name")).trim();
        const errs: typeof fieldErrors = {};
        if (name.length < 2) errs.name = t("validation.name");
        if (password.length < 8) errs.password = t("auth.passwordHint");
        setFieldErrors(errs);
        if (Object.keys(errs).length) return;
        setPending(true);
        setError(null);
        const res = await signUpWithPasswordAction({ name, email: String(form.get("email")).trim(), password, locale, next });
        if (!res.ok) {
          setPending(false);
          return setError(t(res.error));
        }
        if (res.needsConfirmation) return setCheckEmail(true);
        await recordConsent();
        router.replace(next);
        router.refresh();
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label={t("auth.name")} error={fieldErrors.name} required>
        {(p) => <Input {...p} name="name" autoComplete="name" minLength={2} maxLength={80} />}
      </Field>
      <Field label={t("auth.email")} hint={t("auth.emailHint")} required>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} />}
      </Field>
      <Field label={t("auth.password")} hint={t("auth.passwordHint")} error={fieldErrors.password} required>
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <PasswordStrength password={password} />
      <Checkbox
        required
        name="consent"
        label={
          <>
            {before}
            <Link href={`/${locale}/policies/terms`} className="text-primary underline" target="_blank">
              {t("auth.consentTerms")}
            </Link>
            {mid}
            <Link href={`/${locale}/policies/privacy`} className="text-primary underline" target="_blank">
              {t("auth.consentPrivacy")}
            </Link>
            {end}
          </>
        }
      />
      <Button type="submit" block size="lg" pending={pending}>
        {t("auth.register")}
      </Button>
      <p className="text-center text-xs text-muted">{t("auth.registerPhoneNote")}</p>
    </form>
  );
}

export function SignInLink() {
  const { t, locale } = useI18n();
  const next = useSearchParams().get("next");
  return (
    <>
      {t("auth.haveAccount")}{" "}
      <Link href={`/${locale}/auth/sign-in${next ? `?next=${encodeURIComponent(safeNext(next, `/${locale}/account`))}` : ""}`} className="font-medium text-primary hover:underline">
        {t("common.signIn")}
      </Link>
    </>
  );
}
