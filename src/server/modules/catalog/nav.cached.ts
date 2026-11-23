import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DEVICES_TAG } from "./devices.cached";
import { getSetting } from "@/server/settings";
import { listProductCategories, listProductTypes } from "@/server/modules/shop/catalog.service";
import { categoryCoverImages, listRepairCatalogue } from "./repair-pages.service";

/**
 * Everything the site header menus need, in one cached read: repair categories with their brands,
 * protection categories with product counts, and the support phone (hidden while it is still the placeholder).
 */
export async function cachedHeaderNav() {
  "use cache";
  cacheTag(DEVICES_TAG);
  cacheLife("hours");
  const [repairs, covers, products, types, phone, whatsapp, email] = await Promise.all([
    listRepairCatalogue(),
    categoryCoverImages(),
    listProductCategories(),
    listProductTypes(),
    getSetting("business.supportPhone"),
    getSetting("business.whatsappNumber"),
    getSetting("business.supportEmail"),
  ]);
  // The original seed value "+91 00000 00000" may still be saved in Admin → Settings; never show it.
  const supportPhone = phone && /[1-9]/.test(phone) ? phone : null;
  // wa.me wants the number in international form without "+" or spaces.
  const waDigits = (whatsapp || supportPhone || "").replace(/\D/g, "");
  return {
    repairs: repairs
      .filter((c) => c.brands.length > 0)
      .map((c) => ({
        slug: c.slug,
        nameEn: c.nameEn,
        nameHi: c.nameHi,
        image: covers.get(c.id) ?? null,
        brands: c.brands.map((b) => ({ id: b.id, slug: b.slug, name: b.name })),
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
    supportEmail: email || null,
    whatsapp: waDigits.length >= 10 ? (waDigits.length === 10 ? `91${waDigits}` : waDigits) : null,
  };
}

export type HeaderNav = Awaited<ReturnType<typeof cachedHeaderNav>>;
