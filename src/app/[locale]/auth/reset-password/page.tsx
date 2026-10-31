import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { Skeleton } from "@/components/ui/surface";
import { ResetForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.resetTitle"), robots: { index: false } };
}

export default async function ResetPasswordPage() {
  const { t } = await getT();
  return (
    <AuthShell title={t("auth.resetTitle")}>
      <Suspense fallback={<Skeleton className="h-32" />}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
