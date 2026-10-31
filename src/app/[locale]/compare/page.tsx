import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { alignSpecs, deviceName } from "@/lib/content/specs";
import { pageMetadata } from "@/lib/seo";
import { getCompare, getCompareOptions, getComparisonList } from "@/server/modules/content/content.public";
import { CompareTable, ComparePicker } from "@/components/content/compare-client";
import { ListingSkeleton } from "@/components/content/listing";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/compare", title: t("compare.title"), description: t("compare.metaDescription") });
}

async function CompareBody({ searchParams }: { searchParams: PageProps<"/[locale]/compare">["searchParams"] }) {
  const { t } = await getT();
  const sp = await searchParams;
  const raw = Array.isArray(sp.ids) ? sp.ids.join(",") : (sp.ids ?? "");
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[\w-]{1,120}$/.test(s))
    .slice(0, 3);
  const [devices, options] = await Promise.all([ids.length ? getCompare(ids) : Promise.resolve([]), getCompareOptions()]);
  const selected = devices.map((d) => ({ slug: d.slug, name: d.deviceModel.name, brand: d.deviceModel.brand.name }));
  return (
    <div className="space-y-8">
      <ComparePicker selected={selected} options={options.map((o) => ({ slug: o.slug, modelId: o.deviceModel.id, name: o.deviceModel.name, brand: o.deviceModel.brand.name }))} />
      {devices.length >= 2 ? (
        <CompareTable devices={selected} groups={alignSpecs(devices.map((d) => d.specs))} />
      ) : (
        <p className="rounded-3xl border border-dashed border-border bg-surface p-8 text-center text-muted">{t("compare.empty")}</p>
      )}
    </div>
  );
}

export default async function ComparePage({ searchParams }: PageProps<"/[locale]/compare">) {
  const { t, locale } = await getT();
  const curated = await getComparisonList();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t("compare.title")}</h1>
        <p className="mt-3 text-lg text-muted">{t("compare.subtitle")}</p>
      </header>
      <div className="mt-8">
        <Suspense fallback={<ListingSkeleton />}>
          <CompareBody searchParams={searchParams} />
        </Suspense>
      </div>
      {curated.length > 0 && (
        <section className="mt-14" aria-labelledby="curated-title">
          <h2 id="curated-title" className="text-2xl font-bold tracking-tight">
            {t("compare.curated")}
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {curated.map((c) => (
              <li key={c.id}>
                <Link href={`/${locale}/compare/${c.slug}`} className="group block h-full rounded-2xl border border-border bg-surface p-5 transition hover:border-primary">
                  <p className="font-semibold group-hover:text-primary">{localized(locale, c.titleEn, c.titleHi)}</p>
                  <p className="mt-2 text-xs text-muted">{c.devices.map((d) => deviceName(d.spec.deviceModel.brand.name, d.spec.deviceModel.name)).join(` ${t("compare.vs")} `)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-10 text-sm text-muted">{t("specs.unknownHint")}</p>
    </div>
  );
}
