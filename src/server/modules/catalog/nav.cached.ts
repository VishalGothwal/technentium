import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DEVICES_TAG } from "./devices.cached";
import { getSetting, SETTINGS } from "@/server/settings";
import { listProductCategories, listProductTypes } from "@/server/modules/shop/catalog.service";
import { listRepairCatalogue } from "./repair-pages.service";

/**
 * Everything the site header menus need, in one cached read: repair categories with their brands,
 * protection categories with product counts, and the support phone (hidden while it is still the placeholder).
 */
export async function cachedHeaderNav() {
  "use cache";
  cacheTag(DEVICES_TAG);
  cacheLife("hours");
  const [repairs, products, types, phone, whatsapp] = await Promise.all([
    listRepairCatalogue(),
    listProductCategories(),
    listProductTypes(),
    getSetting("business.supportPhone"),
    getSetting("business.whatsappNumber"),
  ]);
  const supportPhone = phone && phone !== SETTINGS["business.supportPhone"].default ? phone : null;
  // wa.me wants the number in international form without "+" or spaces.
  const waDigits = (whatsapp || supportPhone || "").replace(/\D/g, "");
  return {
    repairs: repairs
      .filter((c) => c.brands.length > 0)
      .map((c) => ({
        slug: c.slug,
        nameEn: c.nameEn,
        nameHi: c.nameHi,
        brands: c.brands.map((b) => ({ slug: b.slug, name: b.name })),
      })),
    products: products
      .filter((c) => c._count.products > 0)
      .map((c) => ({
        slug: c.slug,
        nameEn: c.nameEn,
        nameHi: c.nameHi,
        count: c._count.products,
        types: types.filter((x) => x.category.slug === c.slug).map((x) => ({ slug: x.slug, nameEn: x.nameEn, nameHi: x.nameHi })),
      })),
    supportPhone,
    whatsapp: waDigits.length >= 10 ? (waDigits.length === 10 ? `91${waDigits}` : waDigits) : null,
  };
}

export type HeaderNav = Awaited<ReturnType<typeof cachedHeaderNav>>;
