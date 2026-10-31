"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { isCompleteNational, normalizeIndianMobile } from "@/lib/phone";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
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
      const res = await authClient.phoneNumber.verify({ phoneNumber: target, code: value.trim() });
      if (res.error) {
        setPending(false);
        setError(res.error.status === 429 ? t("auth.tooMany") : t("auth.otpFailed"));
        codeRef.current?.select();
        return;
      }
      onSuccess();
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
    const res = await authClient.phoneNumber.sendOtp({ phoneNumber: target });
    setPending(false);
    if (res.error) {
      setError(res.error.status === 429 ? t("auth.tooMany") : t("validation.phone"));
      return;
    }
    setNormalized(target);
    setCode("");
    setCooldown(RESEND_SECONDS);
    requestAnimationFrame(() => codeRef.current?.focus());
  }

  if (!normalized) {
    return (
      <form
        className="space-y-4"
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

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void verify(normalized, code);
      }}
    >
      <div className="flex items-center justify-between gap-3 rounded-lg bg-primary-soft px-3 py-2.5">
        <p className="text-sm" role="status">
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
          <Input
            {...p}
            ref={codeRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(next);
              // All six digits typed or pasted: check straight away, no extra tap.
              if (next.length === 6 && !pending) void verify(normalized, next);
            }}
            placeholder="••••••"
            className="h-14 text-center font-mono text-2xl tracking-[0.6em]"
          />
        )}
      </Field>
      <Button type="submit" block size="lg" pending={pending} disabled={code.length !== 6}>
        {t("auth.verify")}
      </Button>
      <p className="text-center text-sm" aria-live="polite">
        {cooldown > 0 ? (
          <span className="text-muted">{t("auth.resendIn", { seconds: cooldown })}</span>
        ) : (
          <button type="button" className="font-medium text-primary hover:underline" disabled={pending} onClick={() => void sendCode(normalized)}>
            {t("auth.resend")}
          </button>
        )}
      </p>
    </form>
  );
}
