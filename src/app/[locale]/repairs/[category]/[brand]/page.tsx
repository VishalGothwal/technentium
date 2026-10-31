import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { pageMetadata } from "@/lib/seo";
import { deviceName } from "@/lib/device-name";
import { getRepairBrand } from "@/server/modules/catalog/repair-pages.service";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { Rail } from "@/components/shop/rail";
import { RepairDeviceSearch } from "@/components/repair/device-search";
import { BrandRail, ModelTile, SectionTitle } from "@/components/repair/blocks";

export const instant = false;

type Props = PageProps<"/[locale]/repairs/[category]/[brand]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, brand } = await params;
  const { t, locale } = await getT();
  const data = await getRepairBrand(category, brand);
  if (!data) return { title: t("errors.notFound.device"), robots: { index: false } };
  return pageMetadata({
    locale,
    path: `/repairs/${data.category.slug}/${data.brand.slug}`,
    title: t("repairFlow.brandTitle", { brand: data.brand.name }),
    description: t("repairs.subtitle"),
  });
}

export default async function RepairBrandPage({ params }: Props) {
  const { category: catSlug, brand: brandSlug } = await params;
  const { t, locale } = await getT();
  const data = await getRepairBrand(catSlug, brandSlug);
  if (!data) notFound();
  const { category, brand, models, popular } = data;
  const catName = localized(locale, category.nameEn, category.nameHi);
  const catBase = `/${locale}/repairs/${category.slug}`;
  const brandBase = `${catBase}/${brand.slug}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("repairFlow.brandTitle", { brand: brand.name })}</h1>
          <Breadcrumbs
            className="mt-2"
            items={[
              { name: t("nav.repairs"), path: `/${locale}/repairs` },
              { name: catName, path: catBase },
              { name: brand.name, path: brandBase },
            ]}
          />
        </div>
        <RepairDeviceSearch className="w-full sm:w-80" />
      </div>

      <section className="mt-8" aria-labelledby="model-title">
        <h2 id="model-title" className="mb-4 text-lg font-medium">
          {t("repairFlow.selectModel")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {models.map((m) => (
            <li key={m.id}>
              <ModelTile href={`${brandBase}/${m.slug}`} name={deviceName(brand.name, m.name)} category={category.slug} />
            </li>
          ))}
        </ul>
      </section>

      {category.brands.length > 1 && (
        <section className="mt-14" aria-labelledby="brands-title">
          <SectionTitle id="brands-title">{t("repairFlow.topBrands")}</SectionTitle>
          <div className="mt-5">
            <BrandRail brands={category.brands.filter((b) => b.id !== brand.id)} hrefFor={(b) => `${catBase}/${b}`} label={t("repairFlow.topBrands")} />
          </div>
        </section>
      )}

      {popular.length > 0 && (
        <section className="mt-14" aria-labelledby="popular-title">
          <SectionTitle id="popular-title">{t("repairFlow.topModels")}</SectionTitle>
          <Rail className="mt-5" label={t("repairFlow.topModels")} listClassName="gap-3 py-1">
            {popular.map((m) => (
              <li key={m.id} className="w-40 shrink-0 snap-start">
                <ModelTile href={`${catBase}/${m.brand.slug}/${m.slug}`} name={deviceName(m.brand.name, m.name)} category={category.slug} />
              </li>
            ))}
          </Rail>
        </section>
      )}
    </div>
  );
}
