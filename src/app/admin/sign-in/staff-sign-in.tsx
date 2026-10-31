"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";

/** Email + password, then a TOTP step when two-factor is enabled (Owner accounts). */
export function StaffSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<"password" | "2fa">(params.get("step") === "2fa" ? "2fa" : "password");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const done = () => {
    router.replace("/admin");
    router.refresh();
  };

  if (step === "2fa") {
    return (
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          const code = String(new FormData(e.currentTarget).get("code")).trim();
          const res = await authClient.twoFactor.verifyTotp({ code });
          setPending(false);
          if (res.error) return setError("That code is not valid. Try the current code from your authenticator app.");
          done();
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Authenticator code" hint="6-digit code from your authenticator app." required>
          {(p) => <Input {...p} name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} />}
        </Field>
        <Button type="submit" block pending={pending}>
          Verify
        </Button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setPending(true);
        setError(null);
        const res = await authClient.signIn.email({ email: String(form.get("email")), password: String(form.get("password")) });
        setPending(false);
        if (res.error) return setError(res.error.status === 429 ? "Too many attempts. Wait a minute and try again." : "Email or password is incorrect.");
        if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) return setStep("2fa");
        done();
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Email" required>
        {(p) => <Input {...p} name="email" type="email" autoComplete="username" />}
      </Field>
      <Field label="Password" required>
        {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" />}
      </Field>
      <Button type="submit" block pending={pending}>
        Sign in
      </Button>
      <p className="text-center text-xs text-muted">
        New staff accounts receive a set-password email from the Owner&apos;s invitation.
      </p>
    </form>
  );
}
