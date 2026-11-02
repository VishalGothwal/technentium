"use client";
import { useState } from "react";
import { requestOwnEmailChangeAction, updateOwnProfileAction } from "@/app/admin/(console)/profile/actions";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";

export function OwnProfileForm({ profile }: { profile: { name: string; displayName: string; preferredLocale: string } }) {
  const { run, pending, error, fields } = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setSaved(false);
        run(
          () =>
            updateOwnProfileAction({
              name: f.get("name"),
              displayName: f.get("displayName"),
              preferredLocale: f.get("preferredLocale"),
            }),
          () => setSaved(true),
        );
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Profile saved.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={fields.name} required>
          {(p) => <Input {...p} name="name" defaultValue={profile.name} />}
        </Field>
        <Field label="Display name" hint="Shown to colleagues in the console." error={fields.displayName} required>
          {(p) => <Input {...p} name="displayName" defaultValue={profile.displayName} />}
        </Field>
        <Field label="Language" error={fields.preferredLocale}>
          {(p) => (
            <Select {...p} name="preferredLocale" defaultValue={profile.preferredLocale}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </Select>
          )}
        </Field>
      </div>
      <Button type="submit" pending={pending}>
        Save profile
      </Button>
    </form>
  );
}

export function OwnEmailForm({ email }: { email: string | null }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const next = String(new FormData(e.currentTarget).get("email") ?? "");
        setPending(true);
        const res = await requestOwnEmailChangeAction(next);
        setPending(false);
        setMsg(
          res.ok
            ? {
                ok: true,
                text: `We sent a confirmation link to ${next}. Your email changes when you open it.`,
              }
            : { ok: false, text: t(res.error) },
        );
      }}
    >
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <p className="text-sm">
        Current: <span className="font-medium">{email ?? "—"}</span>
      </p>
      <Field label="New email" required>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" />}
      </Field>
      <Button type="submit" variant="secondary" pending={pending}>
        Send confirmation link
      </Button>
    </form>
  );
}
