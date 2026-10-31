"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { SignInClient } from "../sign-in/sign-in-client";
import { RegisterForm } from "./register-form";

/**
 * Sign-up is the same quick flow as sign-in: Google, or a mobile number whose first verification creates the
 * account. The name / email / password form is kept for customers who want it, one tap away.
 */
export function RegisterChooser() {
  const { t } = useI18n();
  const [withEmail, setWithEmail] = useState(false);
  return withEmail ? (
    <div className="space-y-4">
      <RegisterForm />
      <button type="button" onClick={() => setWithEmail(false)} className="block w-full text-center text-sm font-medium text-muted hover:text-foreground hover:underline">
        {t("auth.usePhone")}
      </button>
    </div>
  ) : (
    <div className="space-y-4">
      <SignInClient emailOption={false} />
      <button type="button" onClick={() => setWithEmail(true)} className="block w-full text-center text-sm font-medium text-muted hover:text-foreground hover:underline">
        {t("auth.signUpWithEmail")}
      </button>
    </div>
  );
}
