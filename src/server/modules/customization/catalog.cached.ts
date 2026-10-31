import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getDesign, listDesignOptions, listDesigns } from "./customization.service";

/** Cache tag invalidated by design-catalogue admin actions. */
export const DESIGNS_TAG = "designs";

/** Cached public catalogue reads for pages (route handlers call the services directly). */
export async function cachedDesigns() {
  "use cache";
  cacheTag(DESIGNS_TAG);
  cacheLife("hours");
  return listDesigns();
}

export async function cachedDesignOptions() {
  "use cache";
  cacheTag(DESIGNS_TAG);
  cacheLife("hours");
  return listDesignOptions();
}

export async function cachedDesign(slug: string) {
  "use cache";
  cacheTag(DESIGNS_TAG);
  cacheLife("hours");
  return getDesign(slug).catch(() => null);
}
