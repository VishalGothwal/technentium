"use client";
import { useState } from "react";
import { changePasswordAction, startTotpEnrolmentAction, verifyTotpAction } from "@/app/admin/(security)/security/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";

const ERRORS: Partial<Record<string, string>> = {
  "auth.wrongPassword": "Password is incorrect.",
  "auth.codeInvalid": "That code didn't match. Check the time on your phone and try the current code.",
  "auth.tooMany": "Too many attempts. Wait a few minutes and try again.",
  "auth.weakPassword": "Choose a stronger password (at least 8 characters).",
};
const message = (key: string) => ERRORS[key] ?? "Something went wrong. Please try again.";

/** Six-digit code field, shared by set-up and the sign-in check. */
export function TotpCodeField() {
  return (
    <Field label="6-digit code from your authenticator app" required>
      {(p) => <Input {...p} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="tracking-[0.3em]" />}
    </Field>
  );
}

/** Two-factor set-up: scan the QR code (or type the key), then confirm with a code. */
export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [done, setDone] = useState(enabled);

  if (done)
    return (
      <Alert tone="success">
        Two-factor is on. Each new sign-in asks for a code from your authenticator app. Lost your phone? Ask the Owner to use “Reset two-factor” in
        Users &amp; access, then set it up again here.
      </Alert>
    );
  if (!setup)
    return (
      <div className="space-y-3">
        {error && <Alert tone="danger">{error}</Alert>}
        <p className="text-sm text-muted">Use an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.</p>
        <Button
          pending={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            const res = await startTotpEnrolmentAction();
            setPending(false);
            if (!res.ok) return setError(message(res.error));
            if ("factorId" in res) setSetup({ factorId: res.factorId, qrCode: res.qrCode, secret: res.secret });
          }}
        >
          Set up two-factor
        </Button>
      </div>
    );
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await verifyTotpAction(String(new FormData(e.currentTarget).get("code")), setup.factorId);
        setPending(false);
        if (!res.ok) return setError(message(res.error));
        setDone(true);
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <p className="text-sm">1. Scan this QR code with your authenticator app.</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- QR code is an SVG data URL from Supabase */}
      <img src={setup.qrCode} alt="QR code for your authenticator app" className="size-44 rounded-lg border border-border bg-white p-2" />
      <p className="text-xs text-muted">
        Can&apos;t scan? Enter this key instead: <code className="break-all select-all">{setup.secret}</code>
      </p>
      <p className="text-sm">2. Enter the code the app shows.</p>
      <TotpCodeField />
      <Button type="submit" pending={pending}>
        Turn on two-factor
      </Button>
    </form>
  );
}


export function ChangePasswordForm() {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const newPassword = String(f.get("newPassword"));
        if (newPassword.length < 8)
          return setMsg({
            ok: false,
            text: "New password must be at least 8 characters.",
          });
        if (newPassword !== String(f.get("confirm"))) return setMsg({ ok: false, text: "The new passwords don't match." });
        setPending(true);
        const res = await changePasswordAction(String(f.get("currentPassword")), newPassword);
        setPending(false);
        if (!res.ok)
          return setMsg({
            ok: false,
            text: res.error === "auth.wrongPassword" ? "Current password is incorrect." : message(res.error),
          });
        form.reset();
        setMsg({
          ok: true,
          text: "Password changed. Other devices have been signed out.",
        });
      }}
    >
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <Field label="Current password" required>
        {(p) => <Input {...p} name="currentPassword" type="password" autoComplete="current-password" />}
      </Field>
      <Field label="New password" hint="At least 8 characters." required>
        {(p) => <Input {...p} name="newPassword" type="password" autoComplete="new-password" minLength={8} />}
      </Field>
      <Field label="Confirm new password" required>
        {(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" />}
      </Field>
      <Button type="submit" pending={pending}>
        Change password
      </Button>
    </form>
  );
}
