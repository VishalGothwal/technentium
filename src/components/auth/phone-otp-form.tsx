"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendPhoneOtpAction, verifyPhoneOtpAction } from "@/app/[locale]/auth/actions";
import { isCompleteNational, normalizeIndianMobile } from "@/lib/phone";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { PhoneInput } from "@/components/ui/phone-input";

const RESEND_SECONDS = 30;

/** "+919876543210" → "+91 98765 43210" */
const formatPhone = (e164: string) => `${e164.slice(0, 3)} ${e164.slice(3, 8)} ${e164.slice(8)}`;

type OtpCredential = Credential & { code: string };

/** Mobile OTP sign-in (creates the account on first verification). Used on the sign-in page and inside the booking wizard. */
export function PhoneOtpForm({ onSuccess, autoFocus }: { onSuccess: () => void; autoFocus?: boolean }) {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [normalized, setNormalized] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [focused, setFocused] = useState(false);
  const [shake, setShake] = useState(0);
  const [done, setDone] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const verify = useCallback(
    async (target: string, value: string) => {
      setPending(true);
      setError(null);
      const res = await verifyPhoneOtpAction(target, value.trim());
      if (!res.ok) {
        setPending(false);
        setError(t(res.error));
        setShake((n) => n + 1);
        setCode("");
        codeRef.current?.focus();
        return;
      }
      // Brief success state (green boxes + tick) before moving on.
      setDone(true);
      setTimeout(onSuccess, 650);
    },
    [onSuccess, t],
  );

  // Android Chrome: read the code from the SMS (WebOTP) and submit it without typing.
  useEffect(() => {
    if (!normalized || typeof window === "undefined" || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: ac.signal } as CredentialRequestOptions)
      .then((cred) => {
        const otp = (cred as OtpCredential | null)?.code;
        if (otp && /^\d{6}$/.test(otp)) {
          setCode(otp);
          void verify(normalized, otp);
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, [normalized, verify]);

  async function sendCode(target: string) {
    setPending(true);
    setError(null);
    const res = await sendPhoneOtpAction(target);
    setPending(false);
    if (!res.ok) return setError(t(res.error));
    setNormalized(target);
    setCode("");
    setCooldown(RESEND_SECONDS);
    requestAnimationFrame(() => codeRef.current?.focus());
  }

  if (!normalized) {
    return (
      <form
        className="otp-step space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const n = normalizeIndianMobile(phone);
          if (!n) return setError(t("validation.phone"));
          void sendCode(n);
        }}
      >
        <Field
          label={t("auth.phone")}
          hint={phone && !/^[6-9]/.test(phone) ? t("auth.phoneStarts") : t("auth.phoneHint")}
          error={error}
          required
        >
          {(p) => (
            <PhoneInput
              {...p}
              size="lg"
              autoFocus={autoFocus}
              value={phone}
              onChange={(d) => {
                setPhone(d);
                setError(null);
              }}
            />
          )}
        </Field>
        <Button type="submit" block size="lg" pending={pending} disabled={!isCompleteNational(phone)}>
          {t("auth.sendCode")}
        </Button>
        <p className="text-center text-xs text-muted">{t("auth.phoneNewAccount")}</p>
      </form>
    );
  }

  const active = Math.min(code.length, 5);
  return (
    <form
      className="otp-step space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void verify(normalized, code);
      }}
    >
      <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-soft px-3.5 py-3">
        <p className="flex items-center gap-2 text-sm" role="status">
          <svg viewBox="0 0 24 24" aria-hidden className="size-5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
            <path d="M10.5 18.5h3" />
          </svg>
          {t("auth.codeSent", { phone: formatPhone(normalized) })}
        </p>
        <button
          type="button"
          className="shrink-0 text-sm font-medium text-primary hover:underline"
          onClick={() => {
            setNormalized(null);
            setCode("");
            setError(null);
          }}
        >
          {t("auth.changeNumber")}
        </button>
      </div>

      <Field label={t("auth.code")} error={error} required>
        {(p) => (
          <div key={shake} className={cn("relative", shake > 0 && "otp-shake")}>
            {/* One real input (SMS autofill, paste, screen readers) under six display boxes. */}
            <input
              {...p}
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              disabled={done}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(next);
                setError(null);
                // All six digits typed or pasted: check straight away, no extra tap.
                if (next.length === 6 && !pending) void verify(normalized, next);
              }}
              className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
            />
            <div aria-hidden className="grid grid-cols-6 gap-2 sm:gap-2.5">
              {Array.from({ length: 6 }, (_, i) => {
                const digit = code[i];
                const isActive = focused && !done && !pending && i === active && (code.length < 6 || i === 5);
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative flex h-14 items-center justify-center rounded-xl border-2 bg-surface font-mono text-2xl font-semibold tabular-nums shadow-sm transition-all duration-200 sm:h-16",
                      done
                        ? "border-success bg-success/10 text-success"
                        : error
                          ? "border-danger/70"
                          : isActive
                            ? "-translate-y-0.5 border-primary shadow-[0_6px_20px_-6px_var(--primary)] ring-4 ring-primary/15"
                            : digit
                              ? "border-foreground/30"
                              : "border-border",
                      pending && !done && "otp-wave",
                    )}
                    style={pending && !done ? { animationDelay: `${i * 70}ms` } : done ? { transitionDelay: `${i * 50}ms` } : undefined}
                  >
                    {digit ? <span className="otp-digit">{digit}</span> : isActive ? <span className="otp-caret h-7 w-0.5 rounded bg-primary" /> : <span className="size-1.5 rounded-full bg-border" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Field>

      <Button type="submit" block size="lg" pending={pending && !done} disabled={code.length !== 6 || done} className={cn("transition-colors", done && "!bg-success")}>
        {done ? (
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path className="otp-check" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            {t("auth.verified")}
          </span>
        ) : (
          t("auth.verify")
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 text-sm" aria-live="polite">
        {cooldown > 0 ? (
          <>
            <svg viewBox="0 0 20 20" aria-hidden className="size-5 -rotate-90">
              <circle cx="10" cy="10" r="8" fill="none" stroke="var(--border)" strokeWidth="2" />
              <circle
                cx="10"
                cy="10"
                r="8"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={50.27}
                strokeDashoffset={50.27 * (1 - cooldown / RESEND_SECONDS)}
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
            </svg>
            <span className="text-muted tabular-nums">{t("auth.resendIn", { seconds: cooldown })}</span>
          </>
        ) : (
          <button type="button" className="font-medium text-primary hover:underline" disabled={pending || done} onClick={() => void sendCode(normalized)}>
            {t("auth.resend")}
          </button>
        )}
      </div>
    </form>
  );
}
