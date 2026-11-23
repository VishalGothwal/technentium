/**
 * Phone series per brand, named the way each brand groups its line-up (iPhone 17 series, Galaxy A series, Nord CE…),
 * so long model lists can be split into sections. Derived from the model name, so new models need no extra data.
 * Brands without rules (or names that match none) fall into "Other models".
 */

export type Series = { key: string; label: string; order: number };

type Rule = [label: string, test: RegExp];

/** Fixed series in display order (flagship lines first). */
const RULES: Record<string, Rule[]> = {
  samsung: [
    ["Galaxy S series", /^Galaxy S\d/],
    ["Galaxy Z series", /^Galaxy Z /],
    ["Galaxy A series", /^Galaxy A\d/],
    ["Galaxy M series", /^Galaxy M\d/],
    ["Galaxy F series", /^Galaxy F\d/],
  ],
  oneplus: [
    ["OnePlus series", /^OnePlus \d/],
    ["Nord series", /Nord(?! CE)/],
    ["Nord CE series", /Nord CE/],
  ],
  xiaomi: [
    ["Xiaomi series", /^Xiaomi \d/],
    ["Redmi Note series", /^Redmi Note/],
    ["Redmi series", /^Redmi /],
  ],
  poco: [
    ["Poco F series", /^Poco F\d/],
    ["Poco X series", /^Poco X\d/],
    ["Poco M series", /^Poco M\d/],
    ["Poco C series", /^Poco C\d/],
  ],
  vivo: [
    ["X series", /^X(\d| Fold)/],
    ["V series", /^V\d/],
    ["T series", /^T\d/],
    ["Y series", /^Y\d/],
  ],
  oppo: [
    ["Find series", /^Find /],
    ["Reno series", /^Reno /],
    ["F series", /^F\d/],
    ["A series", /^A\d/],
    ["K series", /^K\d/],
  ],
  realme: [
    ["GT series", /\bGT\b/],
    ["Realme series", /^Realme \d/],
    ["P series", /^Realme P\d/],
    ["Narzo series", /^Narzo /],
    ["C series", /^Realme C\d/],
  ],
  iqoo: [
    ["iQOO series", /^iQOO \d/],
    ["Neo series", /^iQOO Neo/],
    ["Z series", /^iQOO Z\d/],
  ],
  motorola: [
    ["Razr series", /^Razr /],
    ["Edge series", /^Edge /],
    ["Moto G series", /^Moto G\d/],
    ["Moto E series", /^Moto E\d/],
  ],
  nothing: [
    ["Phone series", /^Phone \(\d+\)/],
    ["Phone (a) series", /^Phone \(\d+[a-z]\)/],
    ["CMF Phone", /^CMF Phone/],
  ],
  infinix: [
    ["Zero series", /^Zero /],
    ["GT series", /^GT /],
    ["Note series", /^Note /],
    ["Hot series", /^Hot /],
    ["Smart series", /^Smart /],
  ],
  tecno: [
    ["Phantom series", /^Phantom /],
    ["Camon series", /^Camon /],
    ["Pova series", /^Pova /],
    ["Spark series", /^Spark /],
  ],
  lava: [
    ["Agni series", /^Agni /],
    ["Blaze series", /^Blaze /],
    ["Storm series", /^Storm /],
  ],
};

const key = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const numbered = (label: string, n: number): Series => ({ key: key(label), label, order: 1000 - n });

/** Number-led line-ups: one series per generation, newest first. */
function numberedSeries(brandSlug: string, name: string): Series | null {
  if (brandSlug === "apple") {
    if (/^iPhone SE/.test(name)) return { key: "iphone-se", label: "iPhone SE", order: 2000 };
    if (/^iPhone X/.test(name)) return numbered("iPhone X series", 10);
    if (name === "iPhone Air") return numbered("iPhone 17 series", 17); // launched with the iPhone 17 line-up
    if (name === "iPhone Duo") return numbered("iPhone 18 series", 18);
    const n = name.match(/^iPhone (\d+)/);
    return n ? numbered(`iPhone ${n[1]} series`, Number(n[1])) : null;
  }
  if (brandSlug === "google") {
    if (/^Pixel \d+a\b/.test(name)) return { key: "pixel-a-series", label: "Pixel a-series", order: 2000 };
    const n = name.match(/^Pixel (\d+)/);
    return n ? numbered(`Pixel ${n[1]} series`, Number(n[1])) : null;
  }
  return null;
}

export function modelSeries(brandSlug: string, name: string): Series | null {
  const n = numberedSeries(brandSlug, name);
  if (n) return n;
  const rules = RULES[brandSlug];
  const i = rules?.findIndex(([, test]) => test.test(name)) ?? -1;
  return i >= 0 ? { key: key(rules[i][0]), label: rules[i][0], order: i } : null;
}

/** Models grouped by series in display order (input order kept within a series); unmatched models last. */
export function groupBySeries<T extends { name: string }>(brandSlug: string, models: T[], otherLabel: string) {
  const groups = new Map<string, Series & { models: T[] }>();
  for (const m of models) {
    const s = modelSeries(brandSlug, m.name) ?? { key: "other", label: otherLabel, order: 9999 };
    const g = groups.get(s.key) ?? { ...s, models: [] };
    g.models.push(m);
    groups.set(s.key, g);
  }
  return [...groups.values()].sort((a, b) => a.order - b.order);
}
