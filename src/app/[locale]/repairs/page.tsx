import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import type { Locale } from "@/i18n/config";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/cn";
import { HANDOVER_METHODS } from "@/lib/schemas/repair";
import { listRepairCatalogue } from "@/server/modules/catalog/repair-pages.service";
import { Skeleton } from "@/components/ui/surface";
import { RelatedGuides } from "@/components/content/related-guides";
import { RepairDeviceSearch } from "@/components/repair/device-search";
import { DeviceArt } from "@/components/repair/visuals";
import { BrandGrid, HowItWorks, RepairFaq, SectionTitle, ServiceRail, TILE, WhyUs } from "@/components/repair/blocks";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/repairs", title: t("repairs.title"), description: t("repairs.subtitle") });
}

export default async function RepairsPage() {
  const { t, locale } = await getT();
  const points = [t("repairFlow.point1"), t("repairFlow.point2"), t("repairFlow.point3")];
  return (
    <div className="pb-16">
      {/* Hero banner */}
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <div className="relative overflow-hidden rounded-2xl bg-black px-6 py-10 text-white sm:px-10 sm:py-14">
          <div aria-hidden className="absolute -right-16 -bottom-24 size-80 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden className="absolute inset-y-0 right-6 hidden items-center gap-3 lg:flex">
            <DeviceArt category="phone" className="size-40 -rotate-12 text-white/80" />
            <DeviceArt category="laptop" className="size-36 text-white/60" />
          </div>
          <div className="relative max-w-xl">
            <p className="text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">{t("repairFlow.heroEyebrow")}</p>
            <h1 className="mt-2 text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">{t("repairFlow.heroTitle")}</h1>
            <p className="mt-3 text-white/85">{t("repairFlow.heroBody")}</p>
            <ul className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              {points.map((p) => (
                <li key={p} className="rounded-full bg-white/10 px-3 py-1.5">
                  ✓ {p}
                </li>
              ))}
            </ul>
            <RepairDeviceSearch className="mt-6" />
            <Link href={`/${locale}/repairs/book`} className="mt-4 inline-flex h-11 items-center rounded-lg bg-white px-5 text-sm font-bold text-black hover:bg-white/85">
              {t("repairFlow.bookRepair")}
            </Link>
          </div>
        </div>
      </section>

      <Suspense fallback={<CatalogueSkeleton />}>
        <Catalogue locale={locale} />
      </Suspense>

      <HowItWorks t={t} />
      <WhyUs t={t} />

      <section className="mx-auto mt-14 max-w-6xl px-4" aria-labelledby="handover-title">
        <SectionTitle id="handover-title">{t("home.handoverTitle")}</SectionTitle>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HANDOVER_METHODS.map((m) => (
            <li key={m} className="rounded-xl border border-border bg-surface p-4">
              <p className="font-semibold">{t(`handover.${m}.title`)}</p>
              <p className="mt-1 text-sm text-muted">{t(`handover.${m}.body`)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl bg-surface-muted p-4 text-sm">
          <span className="font-semibold">{t("repairs.feeTitle")}: </span>
          <span className="text-muted">{t("repairs.feeBody")}</span>
        </p>
      </section>

      <RepairFaq t={t} className="mx-auto mt-14 max-w-4xl px-4" />
      <Suspense fallback={null}>
        <RelatedGuides topic="repair-guides" className="mx-auto mt-14 max-w-6xl px-4" />
      </Suspense>
    </div>
  );
}

/** Device types, then services and brands for the first (phone) category. */
async function Catalogue({ locale }: { locale: Locale }) {
  const { t } = await getT();
  const categories = await listRepairCatalogue();
  const lead = categories[0];
  if (!lead) return null;
  const catHref = (slug: string) => `/${locale}/repairs/${slug}`;
  return (
    <>
      <section className="mx-auto mt-12 max-w-6xl px-4" aria-labelledby="devices-title">
        <SectionTitle id="devices-title">{t("repairFlow.devicesTitle")}</SectionTitle>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={catHref(c.slug)} className={cn(TILE, "h-36 px-3")}>
                <DeviceArt category={c.slug} className="size-14 text-foreground" />
                <span className="text-sm font-semibold">{localized(locale, c.nameEn, c.nameHi)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-4" aria-labelledby="services-title">
        <SectionTitle id="services-title">
          {t("repairFlow.servicesTitle")} <span className="text-base font-normal text-muted">· {localized(locale, lead.nameEn, lead.nameHi)}</span>
        </SectionTitle>
        <div className="mt-5">
          <ServiceRail services={lead.issues.map((i) => ({ id: i.id, slug: i.slug, name: localized(locale, i.nameEn, i.nameHi) }))} href={catHref(lead.slug)} label={t("repairFlow.servicesTitle")} />
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-4" aria-labelledby="brands-title">
        <SectionTitle id="brands-title">{t("repairFlow.brandsTitle")}</SectionTitle>
        <div className="mt-5">
          <BrandGrid brands={lead.brands} hrefFor={(b) => `${catHref(lead.slug)}/${b}`} t={t} />
        </div>
      </section>
    </>
  );
}

function CatalogueSkeleton() {
  return (
    <div className="mx-auto mt-12 grid max-w-6xl grid-cols-2 gap-3 px-4 sm:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
    </div>
  );
}
