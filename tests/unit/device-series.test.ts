import { describe, expect, it } from "vitest";
import { groupBySeries, modelSeries } from "@/lib/device-series";
import { PHONES } from "../../prisma/seed/devices";

const brandSlug = (b: string) => b.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const label = (brand: string, name: string) => modelSeries(brandSlug(brand), name)?.label;

describe("phone series", () => {
  it("puts every listed phone into a series", () => {
    const unmatched = Object.entries(PHONES).flatMap(([brand, models]) => models.filter(([name]) => !modelSeries(brandSlug(brand), name)).map(([name]) => `${brand} ${name}`));
    expect(unmatched).toEqual([]);
  });

  it("uses each brand's line-up names", () => {
    expect(label("Apple", "iPhone 15 Pro Max")).toBe("iPhone 15 series");
    expect(label("Apple", "iPhone 16e")).toBe("iPhone 16 series");
    expect(label("Apple", "iPhone XS Max")).toBe("iPhone X series");
    expect(label("Apple", "iPhone SE (3rd gen)")).toBe("iPhone SE");
    expect(label("Samsung", "Galaxy Z Flip 6")).toBe("Galaxy Z series");
    expect(label("Samsung", "Galaxy S24 FE")).toBe("Galaxy S series");
    expect(label("Samsung", "Galaxy M34")).toBe("Galaxy M series");
    expect(label("Google", "Pixel 9a")).toBe("Pixel a-series");
    expect(label("Google", "Pixel 10 Pro Fold")).toBe("Pixel 10 series");
    expect(label("OnePlus", "OnePlus Nord CE 4 Lite")).toBe("Nord CE series");
    expect(label("OnePlus", "OnePlus Nord 2T")).toBe("Nord series");
    expect(label("Xiaomi", "Redmi Note 13 Pro+")).toBe("Redmi Note series");
    expect(label("Realme", "Realme GT Neo 3")).toBe("GT series");
    expect(label("Realme", "Realme P3 Pro")).toBe("P series");
    expect(label("Nothing", "Phone (3a) Pro")).toBe("Phone (a) series");
  });

  it("orders numbered series newest first and keeps unmatched models last", () => {
    const groups = groupBySeries("apple", [{ name: "iPhone SE (2nd gen)" }, { name: "iPhone 12" }, { name: "iPhone 17 Pro" }, { name: "iPhone Air" }, { name: "Mystery" }], "Other models");
    expect(groups.map((g) => g.label)).toEqual(["iPhone 17 series", "iPhone 12 series", "iPhone SE", "Other models"]);
    expect(groups[0].models.map((m) => m.name)).toEqual(["iPhone 17 Pro", "iPhone Air"]);
  });
});
