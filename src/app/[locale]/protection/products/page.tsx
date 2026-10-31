import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { localized, type TFunction } from "@/i18n/translate";
import type { Locale } from "@/i18n/config";
import { getDeviceModel } from "@/server/modules/catalog/catalog.service";
import { listProductCategories, listProducts, listProductTypes } from "@/server/modules/shop/catalog.service";
import { PRODUCT_SORTS, type ProductSort } from "@/lib/schemas/shop";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/cn";
import { JsonLd } from "@/components/seo/json-ld";
import { Skeleton } from "@/components/ui/surface";
import { ProductCard, ProductGrid } from "@/components/shop/product-card";
import { MobileFilters, SortSelect } from "@/components/shop/listing-controls";
import { Rail } from "@/components/shop/rail";
import { ProductVisual } from "@/components/shop/product-visual";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/protection/products", title: t("shop.listTitle"), description: t("shop.metaDescription") });
}

type Filters = { q?: string; category?: string; type?: string; device?: string; sort: ProductSort; stock: boolean; page: number };

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

function readFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const sort = str(sp.sort);
  return {
    q: str(sp.q)?.slice(0, 80),
    category: str(sp.category)?.slice(0, 80),
    type: str(sp.type)?.slice(0, 80),
    device: str(sp.device)?.slice(0, 40),
    sort: (PRODUCT_SORTS as readonly string[]).includes(sort ?? "") ? (sort as ProductSort) : "featured",
    stock: str(sp.stock) === "1",
    page: Math.max(1, Number(str(sp.page)) || 1),
  };
}

function hrefWith(locale: string, f: Filters, patch: Partial<Filters>) {
  const next = { ...f, page: 1, ...patch };
  const q = new URLSearchParams();
  if (next.q) q.set("q", next.q);
  if (next.category) q.set("category", next.category);
  if (next.type) q.set("type", next.type);
  if (next.device) q.set("device", next.device);
  if (next.sort !== "featured") q.set("sort", next.sort);
  if (next.stock) q.set("stock", "1");
  if (next.page > 1) q.set("page", String(next.page));
  const s = q.toString();
  return `/${locale}/protection/products${s ? `?${s}` : ""}`;
}

export default async function ProductListingPage({ searchParams }: PageProps<"/[locale]/protection/products">) {
  const { t, locale } = await getT();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("shop.home"), path: `/${locale}` },
          { name: t("shop.title"), path: `/${locale}/protection` },
          { name: t("shop.listTitle"), path: `/${locale}/protection/products` },
        ])}
      />
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
        <Link href={`/${locale}/protection`} className="hover:text-foreground">
          {t("shop.title")}
        </Link>
        <span aria-hidden> / </span>
        <span className="text-foreground">{t("shop.listTitle")}</span>
      </nav>
      <Suspense fallback={<ListingSkeleton />}>
        <Listing locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Listing({ locale, searchParams }: { locale: Locale; searchParams: PageProps<"/[locale]/protection/products">["searchParams"] }) {
  const { t } = await getT();
  const f = readFilters(await searchParams);
  const [result, categories, device, types] = await Promise.all([
    listProducts({ q: f.q, category: f.category, type: f.type, deviceModelId: f.device, sort: f.sort, inStock: f.stock, page: f.page }),
    listProductCategories(),
    f.device ? getDeviceModel(f.device) : null,
    // Types are only offered inside a category (glass types make no sense next to chargers).
    f.category ? listProductTypes(f.category) : Promise.resolve([]),
  ]);
  const activeCategory = categories.find((c) => c.slug === f.category);
  const activeType = types.find((x) => x.slug === f.type);
  const deviceName = device ? `${device.brand.name} ${device.name}` : null;
  const activeCount = [f.category, f.type, f.device, f.stock || undefined].filter(Boolean).length;
  const heading = activeType
    ? localized(locale, activeType.nameEn, activeType.nameHi)
    : activeCategory
      ? localized(locale, activeCategory.nameEn, activeCategory.nameHi)
      : t("shop.listTitle");

  const filterPanel = (
    <FilterPanel
      locale={locale}
      t={t}
      f={f}
      categories={categories.map((c) => ({ slug: c.slug, name: localized(locale, c.nameEn, c.nameHi), count: c._count.products }))}
      types={types.map((x) => ({ slug: x.slug, name: localized(locale, x.nameEn, x.nameHi), count: x.count }))}
      deviceName={deviceName}
    />
  );

  const blurb = activeType
    ? localized(locale, activeType.descriptionEn ?? "", activeType.descriptionHi)
    : activeCategory
      ? localized(locale, activeCategory.descriptionEn ?? "", activeCategory.descriptionHi)
      : t("shop.heroNewBody");
  const typePill = (active: boolean) =>
    cn(
      "inline-flex h-10 items-center gap-2 rounded-lg border py-1 pr-3 pl-1.5 text-sm font-medium whitespace-nowrap transition",
      active ? "border-foreground bg-foreground/5 ring-1 ring-foreground" : "border-border bg-surface hover:border-foreground",
    );
  const pill = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition",
      active ? "border-foreground bg-foreground text-white" : "border-border bg-surface hover:border-foreground",
    );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl leading-none font-bold tracking-tight sm:text-5xl">{heading}</h1>
          {blurb && <p className="mt-3 text-sm text-muted sm:text-base">{blurb}</p>}
          {deviceName && <p className="mt-2 text-sm font-medium">{t("shop.showingFor", { device: deviceName })}</p>}
        </div>
        <form action={`/${locale}/protection/products`} method="get" role="search" className="flex w-full items-center sm:w-72">
          {f.category && <input type="hidden" name="category" value={f.category} />}
          {f.type && <input type="hidden" name="type" value={f.type} />}
          {f.device && <input type="hidden" name="device" value={f.device} />}
          {f.sort !== "featured" && <input type="hidden" name="sort" value={f.sort} />}
          {f.stock && <input type="hidden" name="stock" value="1" />}
          <label className="relative w-full">
            <span className="sr-only">{t("shop.searchLabel")}</span>
            <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={f.q}
              placeholder={t("shop.searchPlaceholder")}
              className="h-10 w-full rounded-xl border border-border bg-surface pr-3 pl-9 text-base sm:text-sm"
            />
          </label>
        </form>
      </div>

      <Rail className="mt-6" listClassName="gap-2 py-1" label={t("shop.category")}>
        <li className="snap-start">
          <Link href={hrefWith(locale, f, { category: undefined, type: undefined })} className={pill(!f.category)} aria-current={!f.category ? "page" : undefined}>
            {t("shop.allCategories")}
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.slug} className="snap-start">
            <Link href={hrefWith(locale, f, { category: c.slug, type: undefined })} className={pill(f.category === c.slug)} aria-current={f.category === c.slug ? "page" : undefined}>
              {localized(locale, c.nameEn, c.nameHi)}
            </Link>
          </li>
        ))}
      </Rail>

      {types.length > 0 && (
        <Rail className="mt-3" listClassName="gap-2 py-1" label={t("shop.type")}>
          <li className="snap-start">
            <Link href={hrefWith(locale, f, { type: undefined })} className={typePill(!f.type)} aria-current={!f.type ? "page" : undefined}>
              {t("shop.allTypes")}
            </Link>
          </li>
          {types.map((x) => (
            <li key={x.slug} className="snap-start">
              <Link href={hrefWith(locale, f, { type: x.slug })} className={typePill(f.type === x.slug)} aria-current={f.type === x.slug ? "page" : undefined}>
                <span className="size-7 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                  <ProductVisual imageId={x.imageMediaId} categorySlug={x.category.slug} typeSlug={x.slug} />
                </span>
                {localized(locale, x.nameEn, x.nameHi)}
                <span className="text-xs opacity-60">{x.count}</span>
              </Link>
            </li>
          ))}
        </Rail>
      )}

      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-y border-border py-2">
        <MobileFilters label={activeCount ? t("shop.filtersActive", { count: activeCount }) : t("shop.filters")}>{filterPanel}</MobileFilters>
        <p className="text-xs font-semibold tracking-[0.14em] uppercase" aria-live="polite">
          {t("shop.results", { count: result.total })}
        </p>
        <div className="justify-self-end">
          <SortSelect value={f.sort} hrefFor={Object.fromEntries(PRODUCT_SORTS.map((s) => [s, hrefWith(locale, f, { sort: s })]))} />
        </div>
      </div>

      {(activeCount > 0 || f.q) && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={t("shop.filters")}>
          {f.q && <Chip href={hrefWith(locale, f, { q: undefined })} label={`“${f.q}”`} />}
          {activeCategory && <Chip href={hrefWith(locale, f, { category: undefined, type: undefined })} label={localized(locale, activeCategory.nameEn, activeCategory.nameHi)} />}
          {activeType && <Chip href={hrefWith(locale, f, { type: undefined })} label={localized(locale, activeType.nameEn, activeType.nameHi)} />}
          {deviceName && <Chip href={hrefWith(locale, f, { device: undefined })} label={deviceName} />}
          {f.stock && <Chip href={hrefWith(locale, f, { stock: false })} label={t("shop.inStockOnly")} />}
          <li>
            <Link href={`/${locale}/protection/products`} className="inline-flex h-8 items-center px-2 text-sm font-medium text-primary hover:underline">
              {t("shop.reset")}
            </Link>
          </li>
        </ul>
      )}

      <div className="mt-8">
        <div className="min-w-0">
          {result.items.length === 0 ? (
            <div className="rounded-lg bg-surface-muted p-10 text-center">
              <p className="text-lg font-semibold">{t("shop.noResults")}</p>
              <p className="mt-1 text-sm text-muted">{t("shop.noResultsBody")}</p>
              <Link href={`/${locale}/protection/products`} className="mt-4 inline-block font-semibold text-primary hover:underline">
                {t("shop.reset")}
              </Link>
            </div>
          ) : (
            <ProductGrid className="md:grid-cols-3 lg:grid-cols-3 lg:gap-x-6">
              {result.items.map((p, i) => (
                <li key={p.id}>
                  <ProductCard product={p} locale={locale} t={t} priority={i < 4} />
                </li>
              ))}
            </ProductGrid>
          )}

          {result.pages > 1 && (
            <nav aria-label={t("shop.pageOf", { page: result.page, pages: result.pages })} className="mt-8 flex items-center justify-between gap-3 text-sm">
              {result.page > 1 ? (
                <Link href={hrefWith(locale, f, { page: result.page - 1 })} className="rounded-xl border border-border bg-surface px-4 py-2 font-medium hover:bg-surface-muted" rel="prev">
                  ← {t("shop.prev")}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted">{t("shop.pageOf", { page: result.page, pages: result.pages })}</span>
              {result.page < result.pages ? (
                <Link href={hrefWith(locale, f, { page: result.page + 1 })} className="rounded-xl border border-border bg-surface px-4 py-2 font-medium hover:bg-surface-muted" rel="next">
                  {t("shop.next")} →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      </div>
    </>
  );
}

function Chip({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link href={href} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-sm font-medium text-white hover:bg-foreground/85">
        {label}
        <span aria-hidden>✕</span>
      </Link>
    </li>
  );
}

function FilterPanel({
  locale,
  t,
  f,
  categories,
  types,
  deviceName,
}: {
  locale: Locale;
  t: TFunction;
  f: Filters;
  categories: { slug: string; name: string; count: number }[];
  types: { slug: string; name: string; count: number }[];
  deviceName: string | null;
}) {
  const item = (active: boolean) =>
    cn("flex items-center justify-between rounded-lg px-3 py-2 text-sm", active ? "bg-foreground font-semibold text-white" : "hover:bg-surface-muted");
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t("shop.category")}</h3>
        <ul className="space-y-0.5">
          <li>
            <Link href={hrefWith(locale, f, { category: undefined, type: undefined })} className={item(!f.category)} aria-current={!f.category ? "page" : undefined}>
              {t("shop.allCategories")}
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={hrefWith(locale, f, { category: c.slug, type: undefined })} className={item(f.category === c.slug)} aria-current={f.category === c.slug ? "page" : undefined}>
                <span>{c.name}</span>
                <span className="text-xs opacity-70">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {types.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t("shop.type")}</h3>
          <ul className="space-y-0.5">
            <li>
              <Link href={hrefWith(locale, f, { type: undefined })} className={item(!f.type)} aria-current={!f.type ? "page" : undefined}>
                {t("shop.allTypes")}
              </Link>
            </li>
            {types.map((x) => (
              <li key={x.slug}>
                <Link href={hrefWith(locale, f, { type: x.slug })} className={item(f.type === x.slug)} aria-current={f.type === x.slug ? "page" : undefined}>
                  <span>{x.name}</span>
                  <span className="text-xs opacity-70">{x.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t("shop.device")}</h3>
        {deviceName ? (
          <div className="rounded-xl border border-border bg-surface p-3 text-sm">
            <p className="font-semibold">{deviceName}</p>
            <Link href={hrefWith(locale, f, { device: undefined })} className="mt-1 inline-block text-primary hover:underline">
              {t("shop.clearDevice")}
            </Link>
          </div>
        ) : (
          <Link href={`/${locale}/protection#for-my-device`} className="block rounded-xl border border-dashed border-border p-3 text-sm font-medium text-primary hover:bg-surface-muted">
            {t("shop.shopForDevice")} →
          </Link>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t("shop.availability")}</h3>
        <Link href={hrefWith(locale, f, { stock: !f.stock })} role="switch" aria-checked={f.stock} className="flex items-center gap-3 rounded-lg px-1 py-1 text-sm">
          <span className={cn("relative h-6 w-10 rounded-full transition", f.stock ? "bg-primary" : "bg-border")}>
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition", f.stock ? "left-[1.125rem]" : "left-0.5")} />
          </span>
          {t("shop.inStockOnly")}
        </Link>
      </section>
    </div>
  );
}

function ListingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
