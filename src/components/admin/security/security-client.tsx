"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/surface";

const secretFromUri = (uri: string) => {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
};

/** Groups a base32 secret into blocks of four for easier manual entry. */
const grouped = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();

export function TwoFactorPanel({ enabled, required }: { enabled: boolean; required: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "setup" | "done">("idle");
  const [setup, setSetup] = useState<{ uri: string; backupCodes: string[] } | null>(null);
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
              const res = await authClient.twoFactor.disable({ password: String(new FormData(e.currentTarget).get("password")) });
              setPending(false);
              if (res.error) return setError("Password is incorrect.");
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
    const secret = secretFromUri(setup.uri);
    return (
      <div className="space-y-4">
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          <li>
            In your authenticator app, add an account using this setup key:
            <p className="mt-1 select-all rounded-md bg-surface-muted px-3 py-2 font-mono text-sm tracking-wide">{grouped(secret)}</p>
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
          <li>
            Save these backup codes somewhere safe. Each works once if you lose your phone. They won&apos;t be shown again.
            <ul className="mt-2 grid grid-cols-2 gap-1 rounded-md bg-surface-muted p-3 font-mono text-xs">
              {setup.backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </li>
          <li>Enter the 6-digit code from the app to finish.</li>
        </ol>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            const res = await authClient.twoFactor.verifyTotp({ code: String(new FormData(e.currentTarget).get("code")).trim() });
            setPending(false);
            if (res.error) return setError("That code didn't match. Check the time on your phone and try the current code.");
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
        const res = await authClient.twoFactor.enable({ password: String(new FormData(e.currentTarget).get("password")) });
        setPending(false);
        if (res.error || !res.data) return setError("Password is incorrect.");
        if (!("totpURI" in res.data)) return setError("Authenticator setup is unavailable. Contact the system administrator.");
        setSetup({ uri: res.data.totpURI, backupCodes: res.data.backupCodes });
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
        if (newPassword.length < 8) return setMsg({ ok: false, text: "New password must be at least 8 characters." });
        if (newPassword !== String(f.get("confirm"))) return setMsg({ ok: false, text: "The new passwords don't match." });
        setPending(true);
        const res = await authClient.changePassword({ currentPassword: String(f.get("currentPassword")), newPassword, revokeOtherSessions: true });
        setPending(false);
        if (res.error) return setMsg({ ok: false, text: "Current password is incorrect." });
        form.reset();
        setMsg({ ok: true, text: "Password changed." });
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
