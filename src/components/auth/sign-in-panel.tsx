"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { EmailSignInForm } from "./email-sign-in-form";
import { PhoneOtpForm } from "./phone-otp-form";

const TABS = ["phone", "email"] as const;
type Tab = (typeof TABS)[number];

function TabIcon({ tab }: { tab: Tab }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {tab === "phone" ? (
        <>
          <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
          <path d="M11 18.5h2" />
        </>
      ) : (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </>
      )}
    </svg>
  );
}

/** Tabs: mobile OTP (default — "continue with phone", most customers) or email/password (FR-AUTH-03). */
export function SignInPanel({ onSuccess, forgotHref }: { onSuccess: () => void; forgotHref?: string }) {
  const { t } = useI18n();
  const id = useId();
  const [tab, setTab] = useState<Tab>("phone");
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ phone: null, email: null });

  // WAI-ARIA tabs: arrow keys move between tabs.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={t("auth.signInTitle")} className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1 text-sm" onKeyDown={onKeyDown}>
        {TABS.map((k) => (
          <button
            key={k}
            ref={(el) => {
              refs.current[k] = el;
            }}
            id={`${id}-tab-${k}`}
            role="tab"
            type="button"
            tabIndex={tab === k ? 0 : -1}
            aria-selected={tab === k}
            aria-controls={`${id}-panel-${k}`}
            onClick={() => setTab(k)}
            className={cn("flex items-center justify-center gap-2 rounded-lg py-2.5 font-medium transition", tab === k ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground")}
          >
            <TabIcon tab={k} />
            {k === "phone" ? t("auth.tabPhone") : t("auth.tabEmail")}
          </button>
        ))}
      </div>
      <div id={`${id}-panel-${tab}`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`}>
        {tab === "phone" ? <PhoneOtpForm onSuccess={onSuccess} /> : <EmailSignInForm onSuccess={onSuccess} forgotHref={forgotHref} />}
      </div>
    </div>
  );
}
