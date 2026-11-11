"use client";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { OPTIONAL_STEPS, STEP_LABELS, type OptionalStep } from "@/lib/customization/steps";
import { Alert } from "@/components/ui/surface";
import { setStudioStepsAction } from "./actions";

/** On/off switch per optional studio step; each flip is saved (and audited) straight away. */
export function StudioStepsEditor({ hidden }: { hidden: OptionalStep[] }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [off, setOff] = useState<OptionalStep[]>(hidden);

  const toggle = (step: OptionalStep) => {
    const before = off;
    const next = off.includes(step) ? off.filter((s) => s !== step) : [...off, step];
    setOff(next);
    setError(null);
    start(async () => {
      const res = await setStudioStepsAction(next);
      if (!res.ok) {
        setOff(before);
        setError(t(res.messageKey));
      }
    });
  };

  return (
    <div>
      {error && (
        <Alert tone="danger" className="mb-3">
          {error}
        </Alert>
      )}
      <ul className="divide-y divide-border">
        <li className="flex items-start justify-between gap-4 py-3 text-sm">
          <div>
            <p className="font-medium">Device</p>
            <p className="text-muted">Always on — the customer must pick their model.</p>
          </div>
          <span className="text-xs text-muted">Required</span>
        </li>
        {OPTIONAL_STEPS.map((s) => {
          const on = !off.includes(s);
          return (
            <li key={s} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0 text-sm">
                <p id={`step-${s}`} className="font-medium">
                  {STEP_LABELS[s].label}
                </p>
                <p className="text-muted">{STEP_LABELS[s].description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={`step-${s}`}
                disabled={pending}
                onClick={() => toggle(s)}
                className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${on ? "bg-success" : "bg-border"}`}
              >
                <span aria-hidden className={`inline-block size-5 rounded-full bg-white shadow transition ${on ? "translate-x-5.5" : "translate-x-0.5"}`} />
              </button>
            </li>
          );
        })}
        <li className="flex items-start justify-between gap-4 py-3 text-sm">
          <div>
            <p className="font-medium">Review</p>
            <p className="text-muted">Always on — terms and submit.</p>
          </div>
          <span className="text-xs text-muted">Required</span>
        </li>
      </ul>
    </div>
  );
}
