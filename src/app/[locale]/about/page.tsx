import type { Metadata } from "next";
import { BadgeCheck, House, ListChecks, MapPin, ShieldCheck } from "lucide-react";
import { getT } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { ButtonLink } from "@/components/ui/button";
import { RepairJourney } from "@/components/repair/journey";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/about", title: t("site.about.metaTitle"), description: t("site.about.metaDescription") });
}

const POINTS = [
  ["price", BadgeCheck],
  ["handover", House],
  ["tracking", ListChecks],
  ["warranty", ShieldCheck],
] as const;

export default async function AboutPage() {
  const { t, locale } = await getT();
  return (
    <div className="pb-8">
      <section className="border-b border-border bg-surface-muted">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:py-20">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">{t("site.about.eyebrow")}</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{t("site.about.title")}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">{t("site.about.intro")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-bold tracking-tight">{t("site.about.whyTitle")}</h2>
        <p className="mt-3 leading-relaxed text-muted">{t("site.about.whyBody")}</p>
      </section>

      <section className="mx-auto max-w-5xl px-4">
        <h2 className="text-center text-2xl font-bold tracking-tight">{t("site.about.approachTitle")}</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {POINTS.map(([key, Icon]) => (
            <li key={key} className="rounded-2xl border border-border bg-surface p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface-muted">
                <Icon aria-hidden className="size-5" />
              </span>
              <p className="mt-4 font-semibold">{t(`site.about.points.${key}.title`)}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t(`site.about.points.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <RepairJourney t={t} />

      <section className="mx-auto max-w-5xl px-4 py-14">
        <div className="flex flex-col gap-6 rounded-3xl bg-black p-8 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white/70">
              <MapPin aria-hidden className="size-4" />
              Jaipur
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{t("site.about.jaipurTitle")}</h2>
            <p className="mt-2 leading-relaxed text-white/75">{t("site.about.jaipurBody")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <ButtonLink href={`/${locale}/repairs/book`} variant="inverse" className="rounded-xl">
              {t("site.about.cta")}
            </ButtonLink>
            <ButtonLink href={`/${locale}/help`} variant="secondary" className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20">
              {t("site.about.ctaSecondary")}
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
