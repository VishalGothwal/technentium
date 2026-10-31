"use client";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { setChannelPreferenceAction, updateProfileAction } from "./actions";

export function ProfileForm({ name, preferredLocale }: { name: string; preferredLocale: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        start(async () => {
          const res = await updateProfileAction({ name: form.get("name"), preferredLocale: form.get("preferredLocale") });
          setFields(res.ok ? {} : Object.fromEntries(Object.entries(res.fields ?? {}).map(([k, v]) => [k, t(v)])));
          setMsg(res.ok ? { ok: true, text: t("account.profileSaved") } : { ok: false, text: t(res.messageKey) });
        });
      }}
    >
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("account.name")} error={fields.name} required>
          {(p) => <Input {...p} name="name" defaultValue={name} autoComplete="name" />}
        </Field>
        <Field label={t("account.preferredLanguage")}>
          {(p) => (
            <Select {...p} name="preferredLocale" defaultValue={preferredLocale}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_LABELS[l]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Button type="submit" pending={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export function PreferencesForm({ channels }: { channels: { channel: string; enabled: boolean }[] }) {
  const { t } = useI18n();
  const [state, setState] = useState(channels);
  const [, start] = useTransition();
  return (
    <div className="space-y-3">
      <Checkbox checked disabled label={t("account.channels.in_app")} />
      {state.map((c) => (
        <Checkbox
          key={c.channel}
          checked={c.enabled}
          label={t(`account.channels.${c.channel}`)}
          onChange={(e) => {
            const enabled = e.target.checked;
            setState(state.map((x) => (x.channel === c.channel ? { ...x, enabled } : x)));
            start(async () => void (await setChannelPreferenceAction(c.channel, enabled)));
          }}
        />
      ))}
    </div>
  );
}
