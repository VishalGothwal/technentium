import type { Locale } from "@/i18n/config";
import { deviceName } from "@/lib/device-name";
import { db } from "@/server/db";
import { searchDevices } from "@/server/modules/catalog/catalog.service";
import { queryContentList, querySpecList } from "@/server/modules/content/content.queries";
import { listProducts } from "@/server/modules/shop/catalog.service";

const PER_GROUP = 5;

/** Header search: phones (repair pages), spec sheets, shop products and articles, a few of each. */
export async function siteSearch(rawQ: string, locale: Locale) {
  const q = rawQ.trim().slice(0, 100);
  if (q.length < 2) return { q, devices: [], specs: [], products: [], articles: [] };
  const [devices, specs, products, articles] = await Promise.all([
    searchDevices({ q, limit: PER_GROUP }),
    querySpecList({ q }),
    listProducts({ q, pageSize: PER_GROUP }),
    queryContentList(locale, { type: "ARTICLE", q, page: 1, pageSize: PER_GROUP }),
  ]);
  // Models without their own photo borrow their spec sheet's.
  const specPhotos = new Map(
    (await db.deviceSpecification.findMany({ where: { deviceModelId: { in: devices.filter((d) => !d.imageMediaId).map((d) => d.id) }, imageMediaId: { not: null } }, select: { deviceModelId: true, imageMediaId: true } })).map(
      (s) => [s.deviceModelId, s.imageMediaId],
    ),
  );
  return {
    q,
    devices: devices.map((d) => ({
      href: `/${locale}/repairs/${d.category.slug}/${d.brand.slug}/${d.slug}`,
      title: deviceName(d.brand.name, d.name),
      sub: d.releaseYear ? String(d.releaseYear) : null,
      imageId: d.imageMediaId ?? specPhotos.get(d.id) ?? null,
    })),
    specs: specs.slice(0, PER_GROUP).map((s) => ({
      href: `/${locale}/specs/${s.slug}`,
      title: `${s.deviceModel.brand.name} ${s.deviceModel.name}`,
      sub: s.deviceModel.releaseYear ? String(s.deviceModel.releaseYear) : null,
      imageId: s.imageMediaId,
    })),
    products: products.items.map((p) => ({
      href: `/${locale}/protection/${p.slug}`,
      title: locale === "hi" && p.nameHi ? p.nameHi : p.nameEn,
      sub: null,
      pricePaise: p.pricePaise,
      imageId: p.imageId,
    })),
    articles: articles.items.map((a) => ({
      href: `/${locale}/articles/${a.slug}`,
      title: a.title,
      sub: a.summary,
      imageId: a.coverMediaId,
    })),
  };
}

export type SiteSearchResult = Awaited<ReturnType<typeof siteSearch>>;
