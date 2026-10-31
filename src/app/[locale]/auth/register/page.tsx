import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { Skeleton } from "@/components/ui/surface";
import { RegisterForm, SignInLink } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.registerTitle"), robots: { index: false } };
}

export default async function RegisterPage() {
  const { t } = await getT();
  return (
    <AuthShell
      title={t("auth.registerTitle")}
      subtitle={t("auth.registerSubtitle")}
      footer={
        <Suspense fallback={null}>
          <SignInLink />
        </Suspense>
      }
    >
      <Suspense fallback={<Skeleton className="h-80" />}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
