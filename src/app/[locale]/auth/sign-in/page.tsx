import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { Skeleton } from "@/components/ui/surface";
import { RegisterLink, SignInClient } from "./sign-in-client";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.signInTitle"), robots: { index: false } };
}

export default async function SignInPage() {
  const { t } = await getT();
  return (
    <AuthShell
      title={t("auth.signInTitle")}
      subtitle={t("auth.signInSubtitle")}
      footer={
        <Suspense fallback={null}>
          <RegisterLink />
        </Suspense>
      }
    >
      <Suspense fallback={<Skeleton className="h-48" />}>
        <SignInClient />
      </Suspense>
    </AuthShell>
  );
}
