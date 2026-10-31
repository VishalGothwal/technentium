"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { safeNext } from "@/lib/safe-redirect";
import { SignInPanel } from "@/components/auth/sign-in-panel";

export function SignInClient({ emailOption = true }: { emailOption?: boolean }) {
  const { locale } = useI18n();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"), `/${locale}/account/bookings`);
  return (
    <SignInPanel
      emailOption={emailOption}
      forgotHref={`/${locale}/auth/forgot-password`}
      onSuccess={() => {
        router.replace(next);
        router.refresh();
      }}
    />
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
