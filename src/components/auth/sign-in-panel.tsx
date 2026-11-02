"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Alert } from "@/components/ui/surface";
import { useAuthMethods } from "./auth-methods";
import { EmailSignInForm } from "./email-sign-in-form";
import { GoogleButton } from "./google-button";
import { PhoneOtpForm } from "./phone-otp-form";

/**
 * The quickest way in first: one-tap Google, then mobile number + OTP (creates the account on first
 * verification). Email and password stay available behind a link for customers who prefer it.
 * Each method shows only while the Owner has it switched on.
 */
export function SignInPanel({
  onSuccess,
  forgotHref,
  autoFocus,
  emailOption = true,
}: {
  onSuccess: () => void;
  forgotHref?: string;
  autoFocus?: boolean;
  /** Offer email + password sign-in behind a link (the sign-up page offers email sign-up instead). */
  emailOption?: boolean;
}) {
  const { t } = useI18n();
  const methods = useAuthMethods();
  const showEmail = emailOption && methods.emailPassword;
  const [method, setMethod] = useState<"phone" | "email">(methods.phoneOtp || !showEmail ? "phone" : "email");

  if (!methods.google && !methods.phoneOtp && !showEmail) return <Alert tone="warning">{t("auth.allOff")}</Alert>;

  if (method === "email" && showEmail) {
    return (
      <div className="space-y-4">
        {methods.google && <GoogleButton />}
        <EmailSignInForm onSuccess={onSuccess} forgotHref={forgotHref} />
        {methods.phoneOtp && (
          <button
            type="button"
            onClick={() => setMethod("phone")}
            className="block w-full text-center text-sm font-medium text-muted hover:text-foreground hover:underline"
          >
            {t("auth.usePhone")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {methods.google && <GoogleButton />}
      {methods.google && methods.phoneOtp && (
        <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-muted uppercase">
          <span className="h-px flex-1 bg-border" />
          {t("auth.orPhone")}
          <span className="h-px flex-1 bg-border" />
        </div>
      )}
      {methods.phoneOtp && <PhoneOtpForm onSuccess={onSuccess} autoFocus={autoFocus && !methods.google} />}
      {showEmail && (
        <button
          type="button"
          onClick={() => setMethod("email")}
          className="block w-full text-center text-sm font-medium text-muted hover:text-foreground hover:underline"
        >
          {t("auth.useEmail")}
        </button>
      )}
    </div>
  );
}
