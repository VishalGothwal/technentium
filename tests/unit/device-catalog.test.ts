import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { DEFAULT_FRAME, FRAME_FAMILIES, FRAME_KEYS, frameFor, frontLayout, isFrameKey } from "@/lib/device-frames";
import { deviceSlug } from "@/lib/device-name";
import { readConfig } from "@/lib/customization/config";
import { PHONES, phoneAliases } from "../../prisma/seed/devices";

describe("device frames", () => {
  it("returns the model's own family when known", () => {
    expect(frameFor("iphone-pro").lenses).toHaveLength(3);
    expect(frameFor("galaxy-ultra").lenses).toHaveLength(5);
    expect(frameFor("pixel-bar").modules[0]).toMatchObject({ shape: "rect", w: 252 });
  });

  it("falls back to the category default for missing or unknown frames", () => {
    expect(frameFor(null, "phone")).toBe(FRAME_FAMILIES[DEFAULT_FRAME.phone]);
    expect(frameFor("not-a-frame", "tablet")).toBe(FRAME_FAMILIES.tablet);
    expect(frameFor(undefined, "laptop").logo).not.toBeNull();
    expect(isFrameKey("round-center")).toBe(true);
    expect(isFrameKey("constructor")).toBe(false);
  });

  it("keeps every lens and module inside the body", () => {
    for (const key of FRAME_KEYS) {
      const g = FRAME_FAMILIES[key];
      for (const [x, y, r] of g.lenses) {
        expect(x - r, key).toBeGreaterThanOrEqual(0);
        expect(y + r, key).toBeLessThanOrEqual(g.h);
        expect(x + r, key).toBeLessThanOrEqual(g.w);
      }
      for (const m of g.modules) {
        if (m.shape === "rect") expect(m.x + m.w, key).toBeLessThanOrEqual(g.w);
        else expect(m.cx + m.r, key).toBeLessThanOrEqual(g.w);
      }
    }
  });

  it("lays out the front with the right cut-out", () => {
    expect(frontLayout(FRAME_FAMILIES["iphone-pro"]).cutouts[0]).toMatchObject({ shape: "rect", w: 92 });
    expect(frontLayout(FRAME_FAMILIES["iphone-se"]).cutouts).toHaveLength(2);
    expect(frontLayout(FRAME_FAMILIES["galaxy-s"]).cutouts[0]).toMatchObject({ shape: "circle" });
  });
});

describe("device slugs and seed catalogue", () => {
  it("spells + as plus so S24 and S24+ never collide", () => {
    expect(deviceSlug("Galaxy S24+")).toBe("galaxy-s24-plus");
    expect(deviceSlug("Galaxy S24")).toBe("galaxy-s24");
    expect(deviceSlug("Phone (2a)")).toBe("phone-2a");
    expect(deviceSlug("Redmi Note 13 Pro+")).toBe("redmi-note-13-pro-plus");
  });

  it("has unique model slugs per brand, valid frames and sane years", () => {
    for (const [brand, models] of Object.entries(PHONES)) {
      const slugs = models.map(([name]) => deviceSlug(name));
      expect(new Set(slugs).size, brand).toBe(slugs.length);
      for (const [name, year, frame] of models) {
        expect(isFrameKey(frame), `${brand} ${name}`).toBe(true);
        expect(year, `${brand} ${name}`).toBeGreaterThanOrEqual(2019);
        expect(year, `${brand} ${name}`).toBeLessThanOrEqual(2026);
      }
    }
  });

  it("derives search shorthands", () => {
    expect(phoneAliases("Samsung", "Galaxy S24 Ultra")).toContain("s24u");
    expect(phoneAliases("Apple", "iPhone 15 Pro Max")).toContain("15pm");
    expect(phoneAliases("Nothing", "Phone (2a)")).toContain("phone2a");
  });
});

describe("CSV reader", () => {
  it("handles quotes, escaped quotes, CRLF and blank lines", () => {
    const csv = '﻿category,brand,model\r\nphone,Samsung,"Galaxy S24, Ultra"\r\n\r\nphone,"Say ""hi""",X\n';
    expect(parseCsv(csv)).toEqual([
      ["category", "brand", "model"],
      ["phone", "Samsung", "Galaxy S24, Ultra"],
      ["phone", 'Say "hi"', "X"],
    ]);
  });

  it("keeps empty cells and trims whitespace", () => {
    expect(parseCsv("a, b ,,c")).toEqual([["a", "b", "", "c"]]);
  });
});

describe("customization snapshot", () => {
  const base = {
    version: 1,
    design: null,
    style: { pattern: "solid", palette: ["#000000", "#ffffff"], density: 5, angle: 45 },
    finish: { id: "f", slug: "matte", nameEn: "Matte", nameHi: null, deltaPaise: 0 },
    coverage: { id: "c", slug: "back", nameEn: "Back", nameHi: null, deltaPaise: 0 },
    text: null,
    artwork: null,
    estimate: { basePaise: 0, finishPaise: 0, coveragePaise: 0, totalPaise: 0 },
  };

  it("reads older snapshots without a frame", () => {
    const c = readConfig({ ...base, device: { id: "d", name: "iPhone 15", brand: "Apple", kind: "phone" } });
    expect(c).not.toBeNull();
    expect(c!.device.frame).toBeUndefined();
  });

  it("keeps the frame on newer snapshots", () => {
    const c = readConfig({ ...base, device: { id: "d", name: "iPhone 16 Pro", brand: "Apple", kind: "phone", frame: "iphone-pro" } });
    expect(c?.device.frame).toBe("iphone-pro");
  });
});
