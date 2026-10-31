import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/server/db";

/** Cache tag invalidated by device-catalogue admin actions. */
export const DEVICES_TAG = "devices";

/** One category's full brand → model tree for device pickers: popular first, then newest. */
export async function cachedDeviceCatalog(categorySlug: string) {
  "use cache";
  cacheTag(DEVICES_TAG);
  cacheLife("hours");
  const active = { active: true } as const;
  const brands = await db.deviceBrand.findMany({
    where: { ...active, category: { slug: categorySlug, ...active }, models: { some: active } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      models: {
        where: active,
        orderBy: [{ popular: "desc" }, { releaseYear: { sort: "desc", nulls: "last" } }, { name: "asc" }],
        select: { id: true, slug: true, name: true, releaseYear: true, popular: true, frame: true },
      },
    },
  });
  return { category: categorySlug, brands };
}
