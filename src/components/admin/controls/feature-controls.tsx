"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { clearTestOtpsAction, updateFeaturesAction } from "@/app/admin/(console)/controls/actions";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";

export type Switch = {
  key: string;
  label: string;
  description: string;
  on: boolean;
  danger?: boolean;
};

/** A list of on/off switches; each change is saved (and audited) the moment it is flipped. */
export function SwitchList({ switches }: { switches: Switch[] }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState(() => Object.fromEntries(switches.map((s) => [s.key, s.on])));
  return (
    <div>
      {error && (
        <Alert tone="danger" className="mb-3">
          {error}
        </Alert>
      )}
      <ul className="divide-y divide-border">
        {switches.map((s) => {
          const on = values[s.key];
          return (
            <li key={s.key} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0 text-sm">
                <p id={`${s.key}-label`} className="font-medium">
                  {s.label}
                </p>
                <p className="text-muted">{s.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={`${s.key}-label`}
                disabled={pending}
                onClick={() => {
                  setValues((v) => ({ ...v, [s.key]: !on }));
                  setError(null);
                  start(async () => {
                    const res = await updateFeaturesAction({ [s.key]: !on });
                    // Saving failed: put the switch back so it shows the real state.
                    if (!res.ok) {
                      setValues((v) => ({ ...v, [s.key]: on }));
                      setError(t(res.messageKey));
                    }
                  });
                }}
                className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${on ? (s.danger ? "bg-danger" : "bg-success") : "bg-border"}`}
              >
                <span aria-hidden className={`inline-block size-5 rounded-full bg-white shadow transition ${on ? "translate-x-5.5" : "translate-x-0.5"}`} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MaintenanceMessageForm({ message }: { message: string }) {
  const { run, pending, error } = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        run(
          () =>
            updateFeaturesAction({
              "features.maintenanceMessage": String(new FormData(e.currentTarget).get("message") ?? ""),
            }),
          () => setSaved(true),
        );
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Message saved.</Alert>}
      <Field label="Message customers see" hint="Leave empty for the standard “We'll be back soon” text.">
        {(p) => <Textarea {...p} name="message" rows={2} maxLength={300} defaultValue={message} />}
      </Field>
      <Button type="submit" size="sm" variant="secondary" pending={pending}>
        Save message
      </Button>
    </form>
  );
}

export function TestOtpTools() {
  const router = useRouter();
  const { run, pending } = useAction();
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => router.refresh()}>
        Refresh
      </Button>
      <Button size="sm" variant="ghost" pending={pending} onClick={() => run(() => clearTestOtpsAction())}>
        Clear
      </Button>
    </div>
  );
}
