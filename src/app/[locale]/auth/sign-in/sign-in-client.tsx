"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { safeNext } from "@/lib/safe-redirect";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { Alert } from "@/components/ui/surface";

/** `?error=` set by /api/auth/callback when a Google or email-link sign-in could not finish. */
const CALLBACK_ERRORS = { link: "auth.linkInvalid", blocked: "auth.blocked", signup: "auth.signUpOff" } as const;

export function SignInClient({ emailOption = true }: { emailOption?: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), `/${locale}/account/bookings`);
  const callbackError = CALLBACK_ERRORS[params.get("error") as keyof typeof CALLBACK_ERRORS];
  return (
    <>
      {callbackError && <Alert tone="danger" className="mb-4">{t(callbackError)}</Alert>}
      <SignInPanel
        emailOption={emailOption}
        forgotHref={`/${locale}/auth/forgot-password`}
        onSuccess={() => {
          router.replace(next);
          router.refresh();
        }}
      />
    </>
  );
}

/** "New here? Create an account" — keeps `next` so registration returns to the same page. */
export function RegisterLink() {
  const { t, locale } = useI18n();
  const next = useSearchParams().get("next");
  const href = `/${locale}/auth/register${next ? `?next=${encodeURIComponent(safeNext(next, `/${locale}/account`))}` : ""}`;
  return (
    <>
      {t("auth.noAccount")}{" "}
      <Link href={href} className="font-medium text-primary hover:underline">
        {t("auth.createAccount")}
      </Link>
    </>
  );
}
