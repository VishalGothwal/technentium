/**
 * Sample specification sheets for popular seeded phones (India variants where they differ).
 * `null` = not verified / not published by the manufacturer — shown as "Not available" (FR-SPEC-04).
 * "No" means the phone definitely lacks the feature. Verify against official sources before launch.
 */
import type { SpecGroup } from "../../src/lib/schemas/content";

type V = string | null;
type Sheet = {
  brand: string;
  model: string;
  releaseDate: string;
  launchPricePaise: number | null;
  summaryEn: string;
  summaryHi?: string;
  display: [size: V, panel: V, resolution: V, refresh: V, protection: V];
  performance: [chipset: V, ram: V, storage: V, expandable: V];
  camera: [main: V, ultrawide: V, telephoto: V, front: V];
  battery: [capacity: V, wired: V, wireless: V];
  build: [dimensions: V, weight: V, ip: V, materials: V];
  connectivity: [network: V, sim: V, port: V, jack: V];
};

export const SPEC_SHEETS: Sheet[] = [
  {
    brand: "apple",
    model: "iphone-16",
    releaseDate: "2024-09-20",
    launchPricePaise: 7990000,
    summaryEn: "Apple's 2024 standard iPhone with the A18 chip, Camera Control button and a 48 MP main camera.",
    summaryHi: "A18 चिप, कैमरा कंट्रोल बटन और 48 MP मुख्य कैमरे वाला Apple का 2024 का स्टैंडर्ड iPhone।",
    display: ["6.1-inch", "Super Retina XDR OLED", "2556 × 1179", "60 Hz", "Ceramic Shield"],
    performance: ["Apple A18", "8 GB", "128 GB / 256 GB / 512 GB", "No"],
    camera: ["48 MP", "12 MP", "No", "12 MP"],
    battery: [null, "USB-C, up to about 50% in 30 min (20 W adapter)", "MagSafe and Qi2"],
    build: ["147.6 × 71.6 × 7.8 mm", "170 g", "IP68", "Aluminium frame, colour-infused glass back"],
    connectivity: ["5G", "Nano-SIM + eSIM", "USB-C (USB 2)", "No"],
  },
  {
    brand: "apple",
    model: "iphone-16-pro",
    releaseDate: "2024-09-20",
    launchPricePaise: 11990000,
    summaryEn: "The 6.3-inch Pro model with a 120 Hz ProMotion display, titanium frame and 5× telephoto camera.",
    display: ["6.3-inch", "Super Retina XDR OLED, ProMotion", "2622 × 1206", "Up to 120 Hz", "Ceramic Shield"],
    performance: ["Apple A18 Pro", "8 GB", "128 GB / 256 GB / 512 GB / 1 TB", "No"],
    camera: ["48 MP", "48 MP", "12 MP, 5× optical", "12 MP"],
    battery: [null, "USB-C", "MagSafe and Qi2"],
    build: ["149.6 × 71.5 × 8.25 mm", "199 g", "IP68", "Titanium frame, textured matte glass back"],
    connectivity: ["5G", "Nano-SIM + eSIM", "USB-C (USB 3)", "No"],
  },
  {
    brand: "apple",
    model: "iphone-15",
    releaseDate: "2023-09-22",
    launchPricePaise: 7990000,
    summaryEn: "The 2023 iPhone that brought USB-C, the Dynamic Island and a 48 MP main camera to the standard model.",
    display: ["6.1-inch", "Super Retina XDR OLED", "2556 × 1179", "60 Hz", "Ceramic Shield"],
    performance: ["Apple A16 Bionic", "6 GB", "128 GB / 256 GB / 512 GB", "No"],
    camera: ["48 MP", "12 MP", "No", "12 MP"],
    battery: [null, "USB-C", "MagSafe and Qi2"],
    build: ["147.6 × 71.6 × 7.8 mm", "171 g", "IP68", "Aluminium frame, colour-infused glass back"],
    connectivity: ["5G", "Nano-SIM + eSIM", "USB-C (USB 2)", "No"],
  },
  {
    brand: "apple",
    model: "iphone-14",
    releaseDate: "2022-09-16",
    launchPricePaise: 7990000,
    summaryEn: "A popular 2022 iPhone with a 6.1-inch OLED display and Lightning port.",
    display: ["6.1-inch", "Super Retina XDR OLED", "2532 × 1170", "60 Hz", "Ceramic Shield"],
    performance: ["Apple A15 Bionic", "6 GB", "128 GB / 256 GB / 512 GB", "No"],
    camera: ["12 MP", "12 MP", "No", "12 MP"],
    battery: [null, "Lightning", "MagSafe"],
    build: ["146.7 × 71.5 × 7.8 mm", "172 g", "IP68", "Aluminium frame, glass back"],
    connectivity: ["5G", "Nano-SIM + eSIM", "Lightning", "No"],
  },
  {
    brand: "samsung",
    model: "galaxy-s24-ultra",
    releaseDate: "2024-01-31",
    launchPricePaise: 12999900,
    summaryEn: "Samsung's 2024 flagship with a built-in S Pen, 200 MP camera, two telephoto lenses and a titanium frame.",
    summaryHi: "बिल्ट-इन S Pen, 200 MP कैमरा, दो टेलीफ़ोटो लेंस और टाइटेनियम फ़्रेम वाला Samsung का 2024 का फ़्लैगशिप।",
    display: ["6.8-inch", "Dynamic AMOLED 2X", "3120 × 1440", "1–120 Hz", "Corning Gorilla Armor"],
    performance: ["Snapdragon 8 Gen 3 for Galaxy", "12 GB", "256 GB / 512 GB / 1 TB", "No"],
    camera: ["200 MP", "12 MP", "50 MP 5× + 10 MP 3×", "12 MP"],
    battery: ["5000 mAh", "45 W", "15 W"],
    build: ["162.3 × 79.0 × 8.6 mm", "232 g", "IP68", "Titanium frame, glass back"],
    connectivity: ["5G", "Dual nano-SIM + eSIM", "USB-C (USB 3.2)", "No"],
  },
  {
    brand: "samsung",
    model: "galaxy-s24",
    releaseDate: "2024-01-31",
    launchPricePaise: 7999900,
    summaryEn: "A compact flagship with a 6.2-inch 120 Hz display and a 3× telephoto camera (Exynos 2400 in India).",
    display: ["6.2-inch", "Dynamic AMOLED 2X", "2340 × 1080", "1–120 Hz", "Corning Gorilla Glass Victus 2"],
    performance: ["Samsung Exynos 2400", "8 GB", "256 GB / 512 GB", "No"],
    camera: ["50 MP", "12 MP", "10 MP, 3× optical", "12 MP"],
    battery: ["4000 mAh", "25 W", "15 W"],
    build: ["147.0 × 70.6 × 7.6 mm", "167 g", "IP68", "Aluminium frame, glass back"],
    connectivity: ["5G", "Dual nano-SIM + eSIM", "USB-C", "No"],
  },
  {
    brand: "samsung",
    model: "galaxy-a55",
    releaseDate: "2024-03-11",
    launchPricePaise: 3999900,
    summaryEn: "A mid-range Galaxy with a metal frame, IP67 rating and a bright 120 Hz AMOLED display.",
    display: ["6.6-inch", "Super AMOLED", "2340 × 1080", "120 Hz", "Corning Gorilla Glass Victus+"],
    performance: ["Samsung Exynos 1480", "8 GB / 12 GB", "128 GB / 256 GB", null],
    camera: ["50 MP", "12 MP", "No", "32 MP"],
    battery: ["5000 mAh", "25 W", "No"],
    build: ["161.1 × 77.4 × 8.2 mm", "213 g", "IP67", "Aluminium frame, glass back"],
    connectivity: ["5G", "Dual nano-SIM", "USB-C", "No"],
  },
  {
    brand: "google",
    model: "pixel-9",
    releaseDate: "2024-08-22",
    launchPricePaise: 7999900,
    summaryEn: "Google's 2024 Pixel with the Tensor G4 chip, 12 GB RAM and long software support.",
    summaryHi: "Tensor G4 चिप, 12 GB रैम और लंबे सॉफ़्टवेयर सपोर्ट वाला Google का 2024 Pixel।",
    display: ["6.3-inch", "Actua OLED", "2424 × 1080", "60–120 Hz", "Corning Gorilla Glass Victus 2"],
    performance: ["Google Tensor G4", "12 GB", "256 GB", "No"],
    camera: ["50 MP", "48 MP", "No", "10.5 MP"],
    battery: ["4700 mAh", "27 W", "Qi wireless charging"],
    build: ["152.8 × 72.0 × 8.5 mm", "198 g", "IP68", "Aluminium frame, glass back"],
    connectivity: ["5G", "Nano-SIM + eSIM", "USB-C (USB 3.2)", "No"],
  },
  {
    brand: "oneplus",
    model: "oneplus-12",
    releaseDate: "2024-01-23",
    launchPricePaise: 6499900,
    summaryEn: "OnePlus's 2024 flagship with very fast 80 W charging, wireless charging and a Hasselblad-tuned camera system.",
    display: ["6.82-inch", "LTPO AMOLED", "3168 × 1440", "1–120 Hz", "Corning Gorilla Glass Victus 2"],
    performance: ["Snapdragon 8 Gen 3", "12 GB / 16 GB", "256 GB / 512 GB", "No"],
    camera: ["50 MP", "48 MP", "64 MP, 3× optical", "32 MP"],
    battery: ["5400 mAh", "80 W SUPERVOOC", "50 W AIRVOOC"],
    build: ["164.3 × 75.8 × 9.15 mm", "220 g", "IP65", "Aluminium frame, glass back"],
    connectivity: ["5G", "Dual nano-SIM", "USB-C (USB 3.2)", "No"],
  },
  {
    brand: "oneplus",
    model: "oneplus-nord-ce-4",
    releaseDate: "2024-04-04",
    launchPricePaise: 2499900,
    summaryEn: "A value phone with a big 5500 mAh battery, 100 W charging and expandable storage.",
    display: ["6.7-inch", "AMOLED", "2412 × 1080", "120 Hz", null],
    performance: ["Snapdragon 7 Gen 3", "8 GB", "128 GB / 256 GB", "Yes, microSD up to 1 TB"],
    camera: ["50 MP", "8 MP", "No", "16 MP"],
    battery: ["5500 mAh", "100 W SUPERVOOC", "No"],
    build: [null, "186 g", "IP54", "Plastic frame and back"],
    connectivity: ["5G", "Dual nano-SIM (hybrid)", "USB-C", "No"],
  },
  {
    brand: "xiaomi",
    model: "redmi-note-13-pro",
    releaseDate: "2024-01-10",
    launchPricePaise: 2599900,
    summaryEn: "A mid-range Redmi with a 200 MP main camera, 1.5K AMOLED display and 67 W charging.",
    display: ["6.67-inch", "AMOLED", "2712 × 1220", "120 Hz", "Corning Gorilla Glass Victus"],
    performance: ["Snapdragon 7s Gen 2", "8 GB / 12 GB", "128 GB / 256 GB / 512 GB", null],
    camera: ["200 MP", "8 MP", "No", "16 MP"],
    battery: ["5100 mAh", "67 W", "No"],
    build: [null, "187 g", "IP54", null],
    connectivity: ["5G", "Dual nano-SIM", "USB-C", "Yes"],
  },
  {
    brand: "nothing",
    model: "phone-2a",
    releaseDate: "2024-03-12",
    launchPricePaise: 2399900,
    summaryEn: "Nothing's distinctive mid-ranger with a transparent-look back, Glyph lights and two 50 MP rear cameras.",
    display: ["6.7-inch", "Flexible AMOLED", "2412 × 1084", "Up to 120 Hz", null],
    performance: ["MediaTek Dimensity 7200 Pro", "8 GB / 12 GB", "128 GB / 256 GB", "No"],
    camera: ["50 MP", "50 MP", "No", "32 MP"],
    battery: ["5000 mAh", "45 W", "No"],
    build: [null, "190 g", "IP54", "Plastic frame and back"],
    connectivity: ["5G", "Dual nano-SIM", "USB-C", "No"],
  },
];

const keys = {
  display: [
    ["size", "Size", "आकार"],
    ["type", "Panel", "पैनल"],
    ["resolution", "Resolution", "रिज़ॉल्यूशन"],
    ["refresh_rate", "Refresh rate", "रिफ़्रेश रेट"],
    ["protection", "Glass protection", "ग्लास सुरक्षा"],
  ],
  performance: [
    ["chipset", "Chipset", "चिपसेट"],
    ["ram", "RAM", "रैम"],
    ["storage", "Storage", "स्टोरेज"],
    ["expandable", "Expandable storage", "बढ़ाने योग्य स्टोरेज"],
  ],
  camera: [
    ["main", "Main camera", "मुख्य कैमरा"],
    ["ultrawide", "Ultra-wide", "अल्ट्रा-वाइड"],
    ["telephoto", "Telephoto", "टेलीफ़ोटो"],
    ["front", "Front camera", "फ़्रंट कैमरा"],
  ],
  battery: [
    ["capacity", "Capacity", "क्षमता"],
    ["wired", "Wired charging", "वायर्ड चार्जिंग"],
    ["wireless", "Wireless charging", "वायरलेस चार्जिंग"],
  ],
  build: [
    ["dimensions", "Dimensions", "आयाम"],
    ["weight", "Weight", "वज़न"],
    ["ip_rating", "Water & dust rating", "पानी और धूल रेटिंग"],
    ["materials", "Materials", "सामग्री"],
  ],
  connectivity: [
    ["network", "Network", "नेटवर्क"],
    ["sim", "SIM", "सिम"],
    ["port", "Port", "पोर्ट"],
    ["headphone_jack", "3.5 mm headphone jack", "3.5 मिमी हेडफ़ोन जैक"],
  ],
} as const;

const groups: [keyof typeof keys, string, string][] = [
  ["display", "Display", "डिस्प्ले"],
  ["performance", "Performance", "परफ़ॉर्मेंस"],
  ["camera", "Cameras", "कैमरा"],
  ["battery", "Battery & charging", "बैटरी और चार्जिंग"],
  ["build", "Build", "बनावट"],
  ["connectivity", "Connectivity", "कनेक्टिविटी"],
];

export function toSpecGroups(s: Sheet): SpecGroup[] {
  return groups.map(([g, labelEn, labelHi]) => ({
    group: g,
    labelEn,
    labelHi,
    items: keys[g].map(([key, lEn, lHi], i) => ({ key, labelEn: lEn, labelHi: lHi, value: (s[g] as V[])[i] ?? null })),
  }));
}

export const COMPARISONS = [
  {
    slug: "iphone-16-vs-galaxy-s24",
    specs: ["apple-iphone-16", "samsung-galaxy-s24"],
    titleEn: "iPhone 16 vs Galaxy S24",
    titleHi: "iPhone 16 बनाम Galaxy S24",
    introEn:
      "Two compact flagships at a similar launch price. The Galaxy S24 adds a 120 Hz display and a 3× telephoto camera; the iPhone 16 counters with the A18 chip, MagSafe accessories and long software support.",
    introHi: "मिलती-जुलती लॉन्च कीमत पर दो कॉम्पैक्ट फ़्लैगशिप। Galaxy S24 में 120 Hz डिस्प्ले और 3× टेलीफ़ोटो कैमरा है; iPhone 16 में A18 चिप और MagSafe एक्सेसरीज़।",
    verdictEn:
      "Choose the Galaxy S24 for the smoother screen and zoom camera. Choose the iPhone 16 if you're already using Apple devices and accessories. Either way, protect the glass back — both are costly to repair.",
    verdictHi: "स्मूद स्क्रीन और ज़ूम कैमरे के लिए Galaxy S24 चुनें। अगर आप पहले से Apple डिवाइस इस्तेमाल करते हैं तो iPhone 16 चुनें।",
  },
  {
    slug: "pixel-9-vs-iphone-16",
    specs: ["google-pixel-9", "apple-iphone-16"],
    titleEn: "Pixel 9 vs iPhone 16",
    introEn: "Google and Apple's 2024 standard models, both around ₹80,000 at launch. The Pixel has a 120 Hz screen and more RAM; the iPhone has a faster chip and the wider accessory ecosystem.",
    verdictEn: "For Android users who value a clean experience and a high-refresh screen, the Pixel 9. For iPhone users or anyone invested in Apple accessories, the iPhone 16.",
  },
  {
    slug: "nord-ce-4-vs-redmi-note-13-pro-vs-nothing-phone-2a",
    specs: ["oneplus-oneplus-nord-ce-4", "xiaomi-redmi-note-13-pro", "nothing-phone-2a"],
    titleEn: "OnePlus Nord CE 4 vs Redmi Note 13 Pro vs Nothing Phone (2a)",
    titleHi: "OnePlus Nord CE 4 बनाम Redmi Note 13 Pro बनाम Nothing Phone (2a)",
    introEn: "Three of the most popular phones around ₹25,000. Battery life, charging speed and cameras separate them more than raw performance.",
    verdictEn:
      "Nord CE 4 for the fastest charging and expandable storage, Redmi Note 13 Pro for the sharpest display and a headphone jack, Phone (2a) for its design and clean software. All three have only IP54 splash resistance — a case and a screen protector are worth it.",
  },
];
