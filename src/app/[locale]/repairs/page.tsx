import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import type { Locale } from "@/i18n/config";
import { pageMetadata } from "@/lib/seo";
import { HANDOVER_METHODS } from "@/lib/schemas/repair";
import { categoryCoverImages, listRepairCatalogue } from "@/server/modules/catalog/repair-pages.service";
import { cachedHeaderNav } from "@/server/modules/catalog/nav.cached";
import { Skeleton } from "@/components/ui/surface";
import { RelatedGuides } from "@/components/content/related-guides";
import { RepairDeviceSearch } from "@/components/repair/device-search";
import { QuickBook } from "@/components/repair/quick-book";
import { BrandGrid, DeviceTypeTile, RepairFaq, SectionTitle, ServiceRail, WhyUs } from "@/components/repair/blocks";
import { RepairJourney } from "@/components/repair/journey";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/repairs", title: t("repairs.title"), description: t("repairs.subtitle") });
}

export default async function RepairsPage() {
  const { t, locale } = await getT();
  const points = [t("repairFlow.point1"), t("repairFlow.point2"), t("repairFlow.point3")];
  return (
    <div className="pb-16">
      {/* Hero: quick booking card beside the headline */}
      <section className="border-b border-border bg-surface-muted">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[22rem_1fr] md:items-center md:gap-12 md:py-14 lg:grid-cols-[24rem_1fr]">
          <div className="md:order-2">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">{t("repairFlow.heroEyebrow")}</p>
            <h1 className="mt-3 text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl">{t("repairFlow.heroTitle")}</h1>
            <span aria-hidden className="mt-5 block h-0.5 w-10 bg-foreground" />
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t("repairFlow.heroBody")}</p>
            <ul className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
              {points.map((p) => (
                <li key={p} className="rounded-full border border-border bg-surface px-3 py-1.5">
                  ✓ {p}
                </li>
              ))}
            </ul>
            <RepairDeviceSearch className="mt-6 max-w-md" />
          </div>
          <div className="md:order-1">
            <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
              <HeroBooking />
            </Suspense>
          </div>
        </div>
      </section>

      <Suspense fallback={<CatalogueSkeleton />}>
        <Catalogue locale={locale} />
      </Suspense>

      <RepairJourney t={t} />
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
async function HeroBooking() {
  const [{ locale }, nav] = await Promise.all([getT(), cachedHeaderNav()]);
  return <QuickBook categories={nav.repairs.map((c) => ({ slug: c.slug, name: localized(locale, c.nameEn, c.nameHi), brands: c.brands }))} />;
}

async function Catalogue({ locale }: { locale: Locale }) {
  const { t } = await getT();
  const [categories, covers] = await Promise.all([listRepairCatalogue(), categoryCoverImages()]);
  const lead = categories[0];
  if (!lead) return null;
  const catHref = (slug: string) => `/${locale}/repairs/${slug}`;
  return (
    <>
      <section className="mx-auto mt-12 max-w-6xl px-4" aria-labelledby="devices-title">
        <SectionTitle id="devices-title">{t("repairFlow.devicesTitle")}</SectionTitle>
        <ul className="mt-5 grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-5">
          {categories.map((c) => (
            <li key={c.id}>
              <DeviceTypeTile href={catHref(c.slug)} slug={c.slug} name={localized(locale, c.nameEn, c.nameHi)} imageId={covers.get(c.id)} />
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
