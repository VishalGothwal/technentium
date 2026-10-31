import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "./forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.forgotTitle"), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const { t, locale } = await getT();
  return (
    <AuthShell
      title={t("auth.forgotTitle")}
      subtitle={t("auth.forgotBody")}
      footer={
        <Link href={`/${locale}/auth/sign-in`} className="font-medium text-primary hover:underline">
          {t("auth.backToSignIn")}
        </Link>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
