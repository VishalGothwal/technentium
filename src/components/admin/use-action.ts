"use client";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";

type Result = { ok: true; data: unknown } | { ok: false; messageKey: string; fields?: Record<string, string> };

/**
 * Run a Server Action with pending state and translated errors.
 * `run(fn, onSuccess?)` — `fields` holds per-field messages from validation errors.
 */
export function useAction() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  function run<R extends Result>(fn: () => Promise<R>, onSuccess?: (data: Extract<R, { ok: true }>["data"]) => void) {
    start(async () => {
      setError(null);
      setFields({});
      const res = await fn();
      if (res.ok) onSuccess?.(res.data as Extract<R, { ok: true }>["data"]);
      else {
        setError(t(res.messageKey));
        setFields(Object.fromEntries(Object.entries(res.fields ?? {}).map(([k, v]) => [k, t(v)])));
      }
    });
  }

  return { run, pending, error, fields, setError };
}
