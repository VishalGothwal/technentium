"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";

/**
 * Consent-based analytics (DPDP Act 2023: analytics only after an explicit opt-in).
 * GA4 loads only when NEXT_PUBLIC_GA_ID is set AND the visitor allowed analytics.
 * The choice is kept in a first-party cookie so the server never needs to know it.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const COOKIE = "tn_consent";
type Consent = "analytics" | "essential" | null;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const listeners = new Set<() => void>();
function readConsent(): Consent {
  const m = document.cookie.match(/(?:^|; )tn_consent=([^;]+)/);
  return m?.[1] === "analytics" || m?.[1] === "essential" ? m[1] : null;
}
function writeConsent(value: Exclude<Consent, null> | "reset") {
  document.cookie =
    value === "reset" ? `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax` : `${COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** "unknown" on the server so the banner never flashes during hydration. */
const useConsent = () => useSyncExternalStore(subscribe, readConsent, () => "unknown" as const);

/**
 * Record a conversion or interaction, e.g. `track("add_to_cart", { item_id })`.
 * A no-op until the visitor has allowed analytics.
 */
export function track(event: string, params: Record<string, string | number | boolean | undefined> = {}) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", event, params);
}

export function Analytics() {
  const consent = useConsent();
  const pathname = usePathname();
  const search = useSearchParams();

  // GA4 page views on client-side navigations (initial page view is sent by config).
  useEffect(() => {
    if (consent === "analytics" && window.gtag)
      window.gtag("event", "page_view", {
        page_path: `${pathname}${search.size ? `?${search}` : ""}`,
      });
  }, [consent, pathname, search]);

  return (
    <>
      {consent === "analytics" && GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(GA_ID)},{anonymize_ip:true,send_page_view:false});`}
          </Script>
        </>
      )}
      {consent === null && <ConsentBanner />}
    </>
  );
}

function ConsentBanner() {
  const { t, locale } = useI18n();
  return (
    <section
      role="region"
      aria-label={t("site.consent.title")}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4"
    >
      <h2 className="font-semibold">{t("site.consent.title")}</h2>
      <p className="mt-1 text-sm text-muted">
        {t("site.consent.body")}{" "}
        <Link href={`/${locale}/policies/privacy`} className="underline">
          {t("site.consent.policy")}
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => writeConsent("analytics")}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          {t("site.consent.accept")}
        </button>
        <button
          type="button"
          onClick={() => writeConsent("essential")}
          className="h-10 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-surface-muted"
        >
          {t("site.consent.reject")}
        </button>
      </div>
    </section>
  );
}

/** Footer link that clears the stored choice so the banner asks again. */
export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => writeConsent("reset")} className="underline-offset-2 hover:text-white hover:underline">
      {label}
    </button>
  );
}
