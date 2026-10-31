import type { SpecGroup } from "@/lib/schemas/content";

/** Starting template for a new specification sheet. Every value starts as unknown (null). */
export const SPEC_TEMPLATE: SpecGroup[] = [
  {
    group: "display",
    labelEn: "Display",
    labelHi: "डिस्प्ले",
    items: [
      { key: "size", labelEn: "Size", labelHi: "आकार", value: null },
      { key: "type", labelEn: "Panel", labelHi: "पैनल", value: null },
      { key: "resolution", labelEn: "Resolution", labelHi: "रिज़ॉल्यूशन", value: null },
      { key: "refresh_rate", labelEn: "Refresh rate", labelHi: "रिफ़्रेश रेट", value: null },
      { key: "protection", labelEn: "Glass protection", labelHi: "ग्लास सुरक्षा", value: null },
    ],
  },
  {
    group: "performance",
    labelEn: "Performance",
    labelHi: "परफ़ॉर्मेंस",
    items: [
      { key: "chipset", labelEn: "Chipset", labelHi: "चिपसेट", value: null },
      { key: "ram", labelEn: "RAM", labelHi: "रैम", value: null },
      { key: "storage", labelEn: "Storage", labelHi: "स्टोरेज", value: null },
      { key: "expandable", labelEn: "Expandable storage", labelHi: "बढ़ाने योग्य स्टोरेज", value: null },
    ],
  },
  {
    group: "camera",
    labelEn: "Cameras",
    labelHi: "कैमरा",
    items: [
      { key: "main", labelEn: "Main camera", labelHi: "मुख्य कैमरा", value: null },
      { key: "ultrawide", labelEn: "Ultra-wide", labelHi: "अल्ट्रा-वाइड", value: null },
      { key: "telephoto", labelEn: "Telephoto", labelHi: "टेलीफ़ोटो", value: null },
      { key: "front", labelEn: "Front camera", labelHi: "फ़्रंट कैमरा", value: null },
    ],
  },
  {
    group: "battery",
    labelEn: "Battery & charging",
    labelHi: "बैटरी और चार्जिंग",
    items: [
      { key: "capacity", labelEn: "Capacity", labelHi: "क्षमता", value: null },
      { key: "wired", labelEn: "Wired charging", labelHi: "वायर्ड चार्जिंग", value: null },
      { key: "wireless", labelEn: "Wireless charging", labelHi: "वायरलेस चार्जिंग", value: null },
    ],
  },
  {
    group: "build",
    labelEn: "Build",
    labelHi: "बनावट",
    items: [
      { key: "dimensions", labelEn: "Dimensions", labelHi: "आयाम", value: null },
      { key: "weight", labelEn: "Weight", labelHi: "वज़न", value: null },
      { key: "ip_rating", labelEn: "Water & dust rating", labelHi: "पानी और धूल रेटिंग", value: null },
      { key: "materials", labelEn: "Materials", labelHi: "सामग्री", value: null },
    ],
  },
  {
    group: "connectivity",
    labelEn: "Connectivity",
    labelHi: "कनेक्टिविटी",
    items: [
      { key: "network", labelEn: "Network", labelHi: "नेटवर्क", value: null },
      { key: "sim", labelEn: "SIM", labelHi: "सिम", value: null },
      { key: "port", labelEn: "Port", labelHi: "पोर्ट", value: null },
      { key: "headphone_jack", labelEn: "3.5 mm headphone jack", labelHi: "3.5 मिमी हेडफ़ोन जैक", value: null },
    ],
  },
];

export type CompareRow = { key: string; labelEn: string; labelHi?: string; values: (string | null)[]; differs: boolean };
export type CompareGroup = { group: string; labelEn: string; labelHi?: string; rows: CompareRow[] };

/**
 * Align several spec sheets into comparable rows (union of groups/keys, in first-seen order).
 * A row "differs" when the known values are not all identical, or some are unknown and others known.
 */
export function alignSpecs(sheets: SpecGroup[][]): CompareGroup[] {
  const groups = new Map<string, CompareGroup & { keys: Map<string, CompareRow> }>();
  sheets.forEach((sheet, col) => {
    for (const g of sheet) {
      let grp = groups.get(g.group);
      if (!grp) {
        grp = { group: g.group, labelEn: g.labelEn, labelHi: g.labelHi ?? undefined, rows: [], keys: new Map() };
        groups.set(g.group, grp);
      }
      for (const it of g.items) {
        let row = grp.keys.get(it.key);
        if (!row) {
          row = { key: it.key, labelEn: it.labelEn, labelHi: it.labelHi ?? undefined, values: sheets.map(() => null), differs: false };
          grp.keys.set(it.key, row);
          grp.rows.push(row);
        }
        row.values[col] = it.value;
      }
    }
  });
  const out: CompareGroup[] = [];
  for (const g of groups.values()) {
    for (const r of g.rows) {
      const norm = r.values.map((v) => (v === null ? null : v.trim().toLowerCase()));
      r.differs = new Set(norm).size > 1;
    }
    out.push({ group: g.group, labelEn: g.labelEn, labelHi: g.labelHi, rows: g.rows });
  }
  return out;
}

/** Look up one spec value by group/key (used for highlights on cards). */
export function specValue(sheet: SpecGroup[], group: string, key: string): string | null {
  return sheet.find((g) => g.group === group)?.items.find((i) => i.key === key)?.value ?? null;
}

/** "Samsung Galaxy S24", but "OnePlus Nord CE 4" rather than "OnePlus OnePlus Nord CE 4". */
export const deviceName = (brand: string, model: string) => (model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`);
