import type { Metadata } from "next";
import { Suspense } from "react";
import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import { LOCALES } from "@/i18n/config";
import { I18nProvider } from "@/i18n/client";
import { getT } from "@/i18n/server";
import { Analytics } from "@/components/site/analytics";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { MaintenanceGate, MaintenanceNotice, TestModeStrip, ViewAsBar } from "@/components/site/platform";
import { AuthMethodsProvider } from "@/components/auth/auth-methods";
import { cachedFeatures } from "@/server/features";

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return {
    title: { default: t("meta.title"), template: `%s · ${t("common.brand")}` },
    description: t("meta.description"),
    alternates: { languages: { en: "/en", hi: "/hi" } },
    openGraph: { locale: locale === "hi" ? "hi_IN" : "en_IN", siteName: "Technentium" },
  };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const [{ locale, t }, features] = await Promise.all([getT(), cachedFeatures()]);
  const authMethods = { ...features.signIn, signUp: features.signUp };
  return (
    <html lang={locale} className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>
          <AuthMethodsProvider value={authMethods}>
            <Suspense fallback={null}>
              <ViewAsBar />
            </Suspense>
            {features.testMode && <TestModeStrip />}
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
              {t("common.skipToContent")}
            </a>
            <Suspense fallback={<div className="h-16 border-b border-border bg-surface lg:h-[6.75rem]" />}>
              <SiteHeader />
            </Suspense>
            <main id="main" className="flex-1">
              {features.maintenance ? (
                // Only while maintenance is on does the page wait on the session (staff still see the site).
                <Suspense fallback={<MaintenanceNotice message={features.maintenanceMessage} />}>
                  <MaintenanceGate message={features.maintenanceMessage}>{children}</MaintenanceGate>
                </Suspense>
              ) : (
                children
              )}
            </main>
            <SiteFooter />
            <Suspense fallback={null}>
              <Analytics />
            </Suspense>
          </AuthMethodsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
