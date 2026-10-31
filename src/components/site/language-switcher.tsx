"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LOCALES, LOCALE_LABELS, switchLocalePath } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";

function Switcher({ tone }: { tone: Tone }) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <nav
      aria-label={t("common.language")}
      className={cn("flex rounded-full p-0.5 text-xs font-semibold", tone === "inverse" ? "bg-white/10" : "border border-border bg-surface")}
    >
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={`${switchLocalePath(pathname, l)}${search ? `?${search}` : ""}`}
          hrefLang={l}
          lang={l}
          aria-current={l === locale ? "true" : undefined}
          className={cn(
            "rounded-full px-2.5 py-1 transition",
            tone === "inverse"
              ? l === locale
                ? "bg-white text-black"
                : "text-white/70 hover:text-white"
              : l === locale
                ? "bg-foreground text-white"
                : "text-muted hover:text-foreground",
          )}
          scroll={false}
        >
          {LOCALE_LABELS[l]}
        </Link>
      ))}
    </nav>
  );
}

type Tone = "default" | "inverse";

/** Keeps the current path and query when switching language (PRD §5.1). `inverse` sits on black. */
export function LanguageSwitcher({ tone = "default" }: { tone?: Tone }) {
  return (
    <Suspense fallback={<span className="h-7 w-28" />}>
      <Switcher tone={tone} />
    </Suspense>
  );
}
