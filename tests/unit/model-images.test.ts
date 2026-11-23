import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deviceSlug } from "@/lib/device-name";
import { OTHER_DEVICES, PHONES } from "../../prisma/seed/devices";

/** prisma/seed/model-images must only hold photos the seed can attach: <brand>/<model>.png for phones, <category>/<brand>/<model>.png otherwise. */
const dir = path.join(process.cwd(), "prisma", "seed", "model-images");
const brandSlug = (b: string) => b.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const listed = new Set([
  ...Object.entries(PHONES).flatMap(([brand, models]) => models.map(([name]) => `phone/${brandSlug(brand)}/${deviceSlug(name)}`)),
  ...Object.entries(OTHER_DEVICES).flatMap(([category, byBrand]) => Object.entries(byBrand).flatMap(([brand, models]) => models.map(([name]) => `${category}/${brandSlug(brand)}/${deviceSlug(name)}`))),
]);

function photoKeys() {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((top) => {
    const brands = top in OTHER_DEVICES ? readdirSync(path.join(dir, top)).map((b) => [top, b] as const) : [["phone", top] as const];
    return brands.flatMap(([category, brand]) =>
      readdirSync(category === "phone" ? path.join(dir, brand) : path.join(dir, category, brand))
        .filter((f) => /\.(png|webp)$/.test(f))
        .map((f) => `${category}/${brand}/${f.replace(/\.(png|webp)$/, "")}`),
    );
  });
}

describe("model photos", () => {
  it("each photo file belongs to a listed model", () => {
    expect(photoKeys().filter((k) => !listed.has(k))).toEqual([]);
  });

  it("model names are unique within a brand", () => {
    const all = [
      ...Object.entries(PHONES).flatMap(([brand, models]) => models.map(([name]) => `phone/${brand}/${deviceSlug(name)}`)),
      ...Object.entries(OTHER_DEVICES).flatMap(([category, byBrand]) => Object.entries(byBrand).flatMap(([brand, models]) => models.map(([name]) => `${category}/${brand}/${deviceSlug(name)}`))),
    ];
    expect(all.filter((k, i) => all.indexOf(k) !== i)).toEqual([]);
  });
});
