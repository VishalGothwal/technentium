"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { EmailSignInForm } from "./email-sign-in-form";
import { GoogleButton, googleSignInEnabled } from "./google-button";
import { PhoneOtpForm } from "./phone-otp-form";

/**
 * The quickest way in first: one-tap Google (when configured), then mobile number + OTP (creates the account
 * on first verification). Email and password stay available behind a link for customers who prefer it.
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
  const [method, setMethod] = useState<"phone" | "email">("phone");

  if (method === "email") {
    return (
      <div className="space-y-4">
        <EmailSignInForm onSuccess={onSuccess} forgotHref={forgotHref} />
        <button type="button" onClick={() => setMethod("phone")} className="block w-full text-center text-sm font-medium text-muted hover:text-foreground hover:underline">
          {t("auth.usePhone")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {googleSignInEnabled && (
        <>
          <GoogleButton />
          <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-muted uppercase">
            <span className="h-px flex-1 bg-border" />
            {t("auth.orPhone")}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <PhoneOtpForm onSuccess={onSuccess} autoFocus={autoFocus && !googleSignInEnabled} />
      {emailOption && (
        <button type="button" onClick={() => setMethod("email")} className="block w-full text-center text-sm font-medium text-muted hover:text-foreground hover:underline">
          {t("auth.useEmail")}
        </button>
      )}
    </div>
  );
}
