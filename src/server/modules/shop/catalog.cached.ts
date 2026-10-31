import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { listFeaturedProducts, listProductCategories, listProductTypes } from "./catalog.service";

/** Cache tag invalidated by product, category, type and stock admin actions. */
export const PRODUCTS_TAG = "products";

/**
 * Cached public store reads for prerendered pages (home, protection landing). Uncached Prisma calls
 * read the clock and would block prerendering; "minutes" keeps stock labels reasonably fresh between edits.
 */
export async function cachedFeaturedProducts(limit: number) {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("minutes");
  return listFeaturedProducts(limit);
}

export async function cachedProductCategories() {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("minutes");
  return listProductCategories();
}

export async function cachedProductTypes(categorySlug?: string | null) {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("minutes");
  return listProductTypes(categorySlug);
}
