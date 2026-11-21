"use client";
import { useState } from "react";
import { changePasswordAction } from "@/app/admin/(security)/security/actions";
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
