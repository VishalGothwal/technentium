import { locale as localeParam } from "next/root-params";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";
import { createT } from "./translate";

/** Current locale from the `[locale]` root segment (customer site only). */
export async function getLocale(): Promise<Locale> {
  const value = await localeParam();
  if (!isLocale(value)) notFound();
  return value;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: createT(locale) };
}
