import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/cn";
import { getRepairCategory, listRepairCatalogue } from "@/server/modules/catalog/repair-pages.service";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { RepairDeviceSearch } from "@/components/repair/device-search";
import { BrandGrid, HowItWorks, SectionTitle, ServiceRail } from "@/components/repair/blocks";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/repairs/[category]">): Promise<Metadata> {
  const { category: slug } = await params;
  const { t, locale } = await getT();
  const c = await getRepairCategory(slug);
  if (!c) return { title: t("errors.notFound.device"), robots: { index: false } };
  const title = t("repairFlow.categoryTitle", { device: localized(locale, c.nameEn, c.nameHi) });
  return pageMetadata({ locale, path: `/repairs/${c.slug}`, title, description: t("repairs.subtitle") });
}

// Resolved outside Suspense so an unknown category returns a real 404.
export default async function RepairCategoryPage({ params }: PageProps<"/[locale]/repairs/[category]">) {
  const { category: slug } = await params;
  const { t, locale } = await getT();
  const all = await listRepairCatalogue();
  const c = all.find((x) => x.slug === slug);
  if (!c) notFound();
  const name = localized(locale, c.nameEn, c.nameHi);
  const base = `/${locale}/repairs/${c.slug}`;

  return (
    <div className="pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("repairFlow.categoryTitle", { device: name })}</h1>
            <Breadcrumbs
              className="mt-2"
              items={[
                { name: t("nav.repairs"), path: `/${locale}/repairs` },
                { name, path: base },
              ]}
            />
          </div>
          <RepairDeviceSearch className="w-full sm:w-80" />
        </div>

        <nav aria-label={t("repairFlow.otherDevices")} className="mt-5 flex flex-wrap gap-2">
          {all.map((x) => (
            <Link
              key={x.id}
              href={`/${locale}/repairs/${x.slug}`}
              aria-current={x.id === c.id ? "page" : undefined}
              className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", x.id === c.id ? "border-primary bg-primary text-white" : "border-border bg-surface hover:border-primary")}
            >
              {localized(locale, x.nameEn, x.nameHi)}
            </Link>
          ))}
        </nav>

        <section className="mt-8" aria-labelledby="brand-title">
          <h2 id="brand-title" className="mb-4 text-lg font-medium">
            {t("repairFlow.selectBrand")}
          </h2>
          <BrandGrid brands={c.brands} hrefFor={(b) => `${base}/${b}`} t={t} />
        </section>

        {c.issues.length > 0 && (
          <section className="mt-12" aria-labelledby="services-title">
            <SectionTitle id="services-title">{t("repairFlow.servicesTitle")}</SectionTitle>
            <div className="mt-5">
              <ServiceRail services={c.issues.map((i) => ({ id: i.id, slug: i.slug, name: localized(locale, i.nameEn, i.nameHi) }))} href="#brand-title" label={t("repairFlow.servicesTitle")} />
            </div>
          </section>
        )}
      </div>
      <HowItWorks t={t} />
    </div>
  );
}
