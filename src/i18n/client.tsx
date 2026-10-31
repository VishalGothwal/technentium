"use client";
import { createContext, use, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { createT, type TFunction } from "./translate";

const I18nContext = createContext<{ locale: Locale; t: TFunction } | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createT(locale) }), [locale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  const ctx = use(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
