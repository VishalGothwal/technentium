"use client";
import { useState, type ComponentProps } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/field";

/** Password field with a show/hide toggle. The toggle's label never starts with "Password" so the field label stays unique. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-12", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}

/** 0–4 score: length, mixed case, digits, symbols. Guidance only — the server enforces the minimum length. */
export function passwordScore(pw: string): number {
  if (pw.length < 8) return pw.length === 0 ? 0 : 1;
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

export function PasswordStrength({ password }: { password: string }) {
  const { t } = useI18n();
  const score = passwordScore(password);
  if (!password) return null;
  const tone = score <= 1 ? "bg-danger" : score === 2 ? "bg-warning" : "bg-success";
  return (
    <div className="space-y-1" aria-live="polite">
      <div className="grid grid-cols-4 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1.5 rounded-full", i <= score ? tone : "bg-surface-muted")} />
        ))}
      </div>
      <p className="text-xs text-muted">{t(`auth.strength.${score}`)}</p>
    </div>
  );
}
