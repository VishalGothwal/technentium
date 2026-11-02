"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { changePasswordAction, confirmTotpAction, disableTotpAction, startTotpAction } from "@/app/admin/(security)/security/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/surface";

/** Groups a base32 secret into blocks of four for easier manual entry. */
const grouped = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();

const ERRORS: Partial<Record<string, string>> = {
  "auth.wrongPassword": "Password is incorrect.",
  "auth.codeInvalid": "That code didn't match. Check the time on your phone and try the current code.",
  "auth.tooMany": "Too many attempts. Wait a few minutes and try again.",
  "auth.weakPassword": "Choose a stronger password (at least 8 characters).",
};
const message = (key: string) => ERRORS[key] ?? "Something went wrong. Please try again.";

export function TwoFactorPanel({ enabled, required }: { enabled: boolean; required: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "setup" | "done">("idle");
  const [setup, setSetup] = useState<{
    factorId: string;
    uri: string;
    secret: string;
    qr: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (stage === "done") {
    return (
      <Alert tone="success" title="Two-factor authentication is on">
        You&apos;ll be asked for a code from your authenticator app when you sign in.
      </Alert>
    );
  }

  if (enabled && stage === "idle") {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm">
          Status: <Badge tone="success">Enabled</Badge>
        </p>
        {required ? (
          <p className="text-sm text-muted">Owner accounts must keep two-factor authentication enabled.</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError(null);
              const res = await disableTotpAction(String(new FormData(e.currentTarget).get("password")));
              setPending(false);
              if (!res.ok) return setError(message(res.error));
              router.refresh();
            }}
          >
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Confirm your password to disable" required>
              {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" />}
            </Field>
            <Button type="submit" variant="danger" size="sm" pending={pending}>
              Disable two-factor
            </Button>
          </form>
        )}
      </div>
    );
  }

  if (stage === "setup" && setup) {
    return (
      <div className="space-y-4">
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          <li>
            Scan this QR code with your authenticator app, or add an account using the setup key:
            {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URI from Supabase */}
            <img src={setup.qr} alt="Authenticator QR code" className="mt-2 size-40 rounded-md bg-white p-2" />
            <p className="mt-2 select-all rounded-md bg-surface-muted px-3 py-2 font-mono text-sm tracking-wide">{grouped(setup.secret)}</p>
            <p className="mt-1 text-xs text-muted">
              Or{" "}
              <a href={setup.uri} className="text-primary underline">
                open the setup link
              </a>{" "}
              on this device, or{" "}
              <button
                type="button"
                className="text-primary underline"
                onClick={async () => {
                  await navigator.clipboard.writeText(setup.uri);
                  setCopied(true);
                }}
              >
                {copied ? "copied" : "copy it"}
              </button>
              .
            </p>
          </li>
          <li>Enter the 6-digit code from the app to finish.</li>
        </ol>
        <p className="text-xs text-muted">Lost your phone later? An Owner can reset your two-factor from Users &amp; access.</p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            const res = await confirmTotpAction(setup.factorId, String(new FormData(e.currentTarget).get("code")).trim());
            setPending(false);
            if (!res.ok) return setError(message(res.error));
            setStage("done");
            router.refresh();
          }}
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Authenticator code" required>
            {(p) => <Input {...p} name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="max-w-40" />}
          </Field>
          <Button type="submit" pending={pending}>
            Verify and turn on
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await startTotpAction(String(new FormData(e.currentTarget).get("password")));
        setPending(false);
        if (!res.ok) return setError(message(res.error));
        if (!("factorId" in res)) return setError(message("errors.generic"));
        setSetup({
          factorId: res.factorId,
          uri: res.uri,
          secret: res.secret,
          qr: res.qr,
        });
        setStage("setup");
      }}
    >
      <p className="flex items-center gap-2 text-sm">
        Status: <Badge tone="warning">Not enabled</Badge>
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Confirm your password to start" required>
        {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" />}
      </Field>
      <Button type="submit" pending={pending}>
        Set up two-factor
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
