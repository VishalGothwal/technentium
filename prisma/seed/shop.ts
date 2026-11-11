import type { PrismaClient } from "../../src/generated/prisma/client";
import { PRODUCT_ADDITIONS } from "./shop-additions";

/**
 * Sample protection-product catalogue (illustrative names, prices and stock — replace before launch).
 * Idempotent: categories and products are upserted by slug; stock is only set when a product is first created.
 */

export type Spec = [labelEn: string, value: string, labelHi?: string];
export type Fits = { brand: string; models?: string[]; category?: string };
export type ProductSeed = {
  slug: string;
  sku: string;
  category: string;
  nameEn: string;
  nameHi: string;
  summaryEn: string;
  summaryHi: string;
  descriptionEn: string;
  price: number; // rupees
  mrp?: number;
  stock: number;
  featured?: boolean;
  universal?: boolean;
  specs: Spec[];
  fits?: Fits[];
  /** ProductType slug within the category (see TYPES). */
  type?: string;
};

/**
 * Shopper-facing product types per category with comparison scores (1–5). Glass traits: clarity, privacy,
 * antiGlare, toughness. Case traits: protection, grip, slim, showsColour.
 * [category, slug, nameEn, nameHi, descriptionEn, descriptionHi, highlights]
 */
const TYPES: [string, string, string, string, string, string, Record<string, number>][] = [
  ["screen-protectors", "normal-clear", "Normal clear (2.5D)", "नॉर्मल क्लियर (2.5D)", "Everyday tempered glass with rounded 2.5D edges. Great value, protects against scratches and small drops.", "रोज़मर्रा का टेम्पर्ड ग्लास, गोल 2.5D किनारों के साथ। किफ़ायती, खरोंच और छोटे गिरने से बचाव।", { clarity: 4, privacy: 1, antiGlare: 1, toughness: 3 }],
  ["screen-protectors", "hd-plus", "HD+ crystal clear", "HD+ क्रिस्टल क्लियर", "High-transparency glass with an oleophobic coating: the screen looks exactly as bright and sharp as without glass.", "हाई-ट्रांसपेरेंसी ग्लास, फ़िंगरप्रिंट-रोधी कोटिंग के साथ — स्क्रीन बिना ग्लास जितनी ही चमकदार और साफ़।", { clarity: 5, privacy: 1, antiGlare: 1, toughness: 3 }],
  ["screen-protectors", "edge-to-edge", "Edge-to-edge full glue", "एज-टू-एज फ़ुल ग्लू", "Covers the whole display with full adhesive, so there are no white edges or air pockets.", "पूरी स्क्रीन को फ़ुल ग्लू से ढकता है — न सफ़ेद किनारे, न हवा के बुलबुले।", { clarity: 4, privacy: 1, antiGlare: 1, toughness: 4 }],
  ["screen-protectors", "privacy", "Privacy (anti-spy)", "प्राइवेसी (एंटी-स्पाई)", "Darkens the screen from the side so people next to you can't read it. Slightly dimmer straight on.", "बगल से स्क्रीन काली दिखती है, ताकि पास बैठे लोग न पढ़ सकें। सामने से थोड़ी कम चमक।", { clarity: 3, privacy: 5, antiGlare: 2, toughness: 3 }],
  ["screen-protectors", "matte", "Matte / anti-glare", "मैट / एंटी-ग्लेयर", "Frosted finish that kills reflections and fingerprints and feels smooth for gaming. Slightly softer image.", "फ़्रॉस्टेड फ़िनिश — रिफ़्लेक्शन और फ़िंगरप्रिंट नहीं, गेमिंग के लिए स्मूथ। तस्वीर थोड़ी सॉफ़्ट।", { clarity: 3, privacy: 1, antiGlare: 5, toughness: 3 }],
  ["screen-protectors", "uv-curved", "UV curved", "UV कर्व्ड", "Liquid adhesive cured with UV light for curved-edge screens; keeps the in-display fingerprint sensor working.", "कर्व्ड स्क्रीन के लिए UV लाइट से जमने वाला लिक्विड ग्लू; इन-डिस्प्ले फ़िंगरप्रिंट सेंसर चलता रहता है।", { clarity: 5, privacy: 1, antiGlare: 1, toughness: 4 }],
  ["screen-protectors", "ceramic", "Ceramic (unbreakable)", "सिरेमिक (अनब्रेकेबल)", "Flexible ceramic film that bends instead of shattering. Best drop protection; a little less glossy.", "लचीली सिरेमिक फ़िल्म जो टूटने की बजाय मुड़ती है। गिरने से सबसे अच्छा बचाव; चमक थोड़ी कम।", { clarity: 3, privacy: 1, antiGlare: 3, toughness: 5 }],
  ["camera-protectors", "lens-glass", "Lens glass", "लेंस ग्लास", "A clear glass plate over the whole camera island.", "पूरे कैमरा आइलैंड पर एक साफ़ ग्लास प्लेट।", {}],
  ["camera-protectors", "metal-ring", "Metal ring", "मेटल रिंग", "Individual sapphire-glass lenses in aluminium rings, one per camera.", "हर कैमरे के लिए एल्युमिनियम रिंग में अलग सैफ़ायर-ग्लास लेंस।", {}],
  ["cases-covers", "normal-silicone", "Normal silicone (soft TPU)", "नॉर्मल सिलिकॉन (सॉफ़्ट TPU)", "Light, flexible back cover with raised edges. The budget everyday choice.", "हल्का, लचीला बैक कवर, उभरे किनारों के साथ। किफ़ायती रोज़मर्रा का विकल्प।", { protection: 2, grip: 3, slim: 4, showsColour: 1 }],
  ["cases-covers", "anti-yellow", "Anti-yellow clear", "एंटी-येलो क्लियर", "Crystal-clear case treated against UV yellowing, so it stays clear and shows your phone's colour.", "UV से पीला न पड़ने वाला क्रिस्टल-क्लियर केस — साफ़ रहता है और फ़ोन का रंग दिखता है।", { protection: 3, grip: 2, slim: 4, showsColour: 5 }],
  ["cases-covers", "liquid-silicone", "Liquid silicone", "लिक्विड सिलिकॉन", "Soft-touch silicone outside with a microfibre lining inside. Premium grip.", "बाहर सॉफ़्ट-टच सिलिकॉन, अंदर माइक्रोफ़ाइबर लाइनिंग। बेहतरीन ग्रिप।", { protection: 3, grip: 5, slim: 3, showsColour: 1 }],
  ["cases-covers", "magsafe", "MagSafe / magnetic", "MagSafe / मैग्नेटिक", "Built-in magnet ring for MagSafe chargers, wallets and car mounts.", "MagSafe चार्जर, वॉलेट और कार माउंट के लिए बिल्ट-इन मैग्नेट रिंग।", { protection: 3, grip: 3, slim: 3, showsColour: 4 }],
  ["cases-covers", "rugged", "Rugged / armour", "रग्ड / आर्मर", "Dual-layer shock protection with air-cushion corners for heavy use.", "भारी इस्तेमाल के लिए डुअल-लेयर शॉक प्रोटेक्शन और एयर-कुशन कॉर्नर।", { protection: 5, grip: 4, slim: 1, showsColour: 1 }],
  ["cases-covers", "slim-matte", "Slim matte", "स्लिम मैट", "Barely-there hard shell with a frosted finish that resists fingerprints.", "बहुत पतला हार्ड शेल, फ़्रॉस्टेड फ़िनिश जो फ़िंगरप्रिंट नहीं पकड़ती।", { protection: 2, grip: 3, slim: 5, showsColour: 3 }],
  ["cases-covers", "flip-wallet", "Flip / wallet", "फ़्लिप / वॉलेट", "Folding cover that protects the screen too, with card slots.", "स्क्रीन को भी ढकने वाला फ़ोल्डिंग कवर, कार्ड स्लॉट के साथ।", { protection: 4, grip: 3, slim: 2, showsColour: 1 }],
];

const CATEGORIES: [slug: string, en: string, hi: string, descEn: string, descHi: string][] = [
  ["screen-protectors", "Screen protectors", "स्क्रीन प्रोटेक्टर", "Tempered glass, privacy and matte guards cut for your exact model.", "आपके मॉडल के लिए टेम्पर्ड ग्लास, प्राइवेसी और मैट गार्ड।"],
  ["cases-covers", "Cases & covers", "केस और कवर", "Drop-tested cases from slim clear shells to rugged armour.", "पतले क्लियर से लेकर मज़बूत आर्मर तक ड्रॉप-टेस्टेड केस।"],
  ["camera-protectors", "Camera lens protectors", "कैमरा लेंस प्रोटेक्टर", "Keep lenses scratch-free without hurting photo quality.", "फ़ोटो क्वालिटी बिगाड़े बिना लेंस को खरोंच से बचाएँ।"],
  ["chargers-cables", "Chargers & cables", "चार्जर और केबल", "Certified fast chargers and braided cables.", "सर्टिफ़ाइड फ़ास्ट चार्जर और ब्रेडेड केबल।"],
  ["power-banks", "Power banks", "पावर बैंक", "Portable power with safe, fast charging.", "सुरक्षित और तेज़ चार्जिंग वाला पोर्टेबल पावर।"],
  ["earbud-cases", "Earbud cases", "ईयरबड केस", "Silicone and hard-shell cases for charging cases.", "चार्जिंग केस के लिए सिलिकॉन और हार्ड-शेल केस।"],
  ["cleaning-kits", "Cleaning kits", "क्लीनिंग किट", "Screen-safe sprays, cloths and port-cleaning tools.", "स्क्रीन-सेफ़ स्प्रे, कपड़े और पोर्ट साफ़ करने के टूल।"],
  ["laptop-sleeves", "Laptop sleeves", "लैपटॉप स्लीव", "Padded sleeves and skins for everyday carry.", "रोज़ाना ले जाने के लिए पैडेड स्लीव और स्किन।"],
];

const IPHONE_RECENT = ["iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max", "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max"];
const IPHONE_OLDER = ["iPhone 12", "iPhone 13", "iPhone 14", "iPhone 14 Plus"];
const SAMSUNG_S = ["Galaxy S23", "Galaxy S24", "Galaxy S24 Ultra", "Galaxy S25", "Galaxy S25 Ultra"];
const SAMSUNG_A = ["Galaxy A35", "Galaxy A55", "Galaxy M34", "Galaxy F55"];

const PRODUCTS: ProductSeed[] = [
  // Screen protectors — one product per common type so every type has stock to browse.
  {
    slug: "hd-plus-crystal-glass-iphone",
    type: "hd-plus",
    sku: "SP-HD-IP-01",
    category: "screen-protectors",
    nameEn: "HD+ Crystal Clear Glass (iPhone)",
    nameHi: "HD+ क्रिस्टल क्लियर ग्लास (iPhone)",
    summaryEn: "High-transparency glass that keeps the display as bright and sharp as bare glass.",
    summaryHi: "हाई-ट्रांसपेरेंसी ग्लास — डिस्प्ले बिना ग्लास जितना ही चमकदार और साफ़।",
    descriptionEn: "99% light transmission with an oleophobic coating that wipes clean. Rounded 2.5D edges and an install frame for a bubble-free fit.",
    price: 399,
    mrp: 899,
    stock: 80,
    featured: true,
    specs: [["Hardness", "9H"], ["Transparency", "99%"], ["Edges", "2.5D"], ["Pack", "2 sheets + frame"]],
    fits: [{ brand: "Apple" }],
  },
  {
    slug: "hd-plus-crystal-glass-android",
    type: "hd-plus",
    sku: "SP-HD-AN-01",
    category: "screen-protectors",
    nameEn: "HD+ Crystal Clear Glass (Android)",
    nameHi: "HD+ क्रिस्टल क्लियर ग्लास (Android)",
    summaryEn: "Cut for your exact model — Samsung, OnePlus, Redmi, Vivo, Oppo, Realme and more.",
    summaryHi: "आपके मॉडल के लिए कटा — Samsung, OnePlus, Redmi, Vivo, Oppo, Realme और भी।",
    descriptionEn: "Model-specific HD+ glass with precise cut-outs for the front camera. Fingerprint-resistant coating.",
    price: 299,
    mrp: 699,
    stock: 120,
    specs: [["Hardness", "9H"], ["Transparency", "99%"], ["Edges", "2.5D"]],
    fits: [{ brand: "Samsung" }, { brand: "OnePlus" }, { brand: "Xiaomi" }, { brand: "Poco" }, { brand: "Vivo" }, { brand: "Oppo" }, { brand: "Realme" }, { brand: "iQOO" }, { brand: "Motorola" }],
  },
  {
    slug: "basic-2-5d-clear-glass-iphone",
    type: "normal-clear",
    sku: "SP-NC-IP-01",
    category: "screen-protectors",
    nameEn: "Basic 2.5D Clear Glass (iPhone)",
    nameHi: "बेसिक 2.5D क्लियर ग्लास (iPhone)",
    summaryEn: "Affordable everyday tempered glass.",
    summaryHi: "किफ़ायती रोज़मर्रा का टेम्पर्ड ग्लास।",
    descriptionEn: "0.3 mm tempered glass with rounded edges. Protects against scratches and minor drops.",
    price: 199,
    mrp: 399,
    stock: 150,
    specs: [["Hardness", "9H"], ["Thickness", "0.3 mm"], ["Edges", "2.5D"]],
    fits: [{ brand: "Apple" }],
  },
  {
    slug: "ceramic-unbreakable-guard-android",
    type: "ceramic",
    sku: "SP-CE-AN-01",
    category: "screen-protectors",
    nameEn: "Ceramic Unbreakable Screen Guard",
    nameHi: "सिरेमिक अनब्रेकेबल स्क्रीन गार्ड",
    summaryEn: "Flexible ceramic film that bends instead of shattering.",
    summaryHi: "लचीली सिरेमिक फ़िल्म जो टूटती नहीं, मुड़ जाती है।",
    descriptionEn: "Full-coverage ceramic guard with full glue. Survives drops that crack normal glass; slightly less glossy, so reflections are reduced.",
    price: 349,
    mrp: 799,
    stock: 90,
    specs: [["Material", "Ceramic film"], ["Coverage", "Full screen, full glue"], ["Finish", "Semi-matte"]],
    fits: [{ brand: "Xiaomi" }, { brand: "Poco" }, { brand: "Realme" }, { brand: "Vivo" }, { brand: "Oppo" }, { brand: "iQOO" }, { brand: "Infinix" }, { brand: "Tecno" }, { brand: "Samsung", models: SAMSUNG_A }],
  },
  {
    slug: "privacy-anti-spy-glass-android",
    type: "privacy",
    sku: "SP-PV-AN-01",
    category: "screen-protectors",
    nameEn: "Privacy Anti-Spy Glass (Android)",
    nameHi: "प्राइवेसी एंटी-स्पाई ग्लास (Android)",
    summaryEn: "Screen goes dark from the side — readable only by you.",
    summaryHi: "बगल से स्क्रीन काली — सिर्फ़ आप पढ़ सकते हैं।",
    descriptionEn: "28° privacy angle, 9H hardness and full glue for Samsung, OnePlus, Vivo and Oppo models.",
    price: 449,
    mrp: 999,
    stock: 60,
    specs: [["Privacy angle", "28°"], ["Hardness", "9H"]],
    fits: [{ brand: "Samsung" }, { brand: "OnePlus" }, { brand: "Vivo" }, { brand: "Oppo" }],
  },
  // Cases & covers
  {
    slug: "anti-yellow-clear-case-iphone",
    type: "anti-yellow",
    sku: "CC-AY-IP-01",
    category: "cases-covers",
    nameEn: "Anti-Yellow Crystal Clear Case (iPhone)",
    nameHi: "एंटी-येलो क्रिस्टल क्लियर केस (iPhone)",
    summaryEn: "Stays crystal clear — UV-resistant coating stops yellowing.",
    summaryHi: "हमेशा क्रिस्टल क्लियर — UV-रोधी कोटिंग पीलापन रोकती है।",
    descriptionEn: "Hard polycarbonate back with soft TPU sides and raised edges around the camera and screen. Shows off your iPhone's colour.",
    price: 599,
    mrp: 1299,
    stock: 70,
    featured: true,
    specs: [["Material", "PC back + TPU sides"], ["Anti-yellowing", "UV-resistant coating"], ["Drop tested", "1.5 m"]],
    fits: [{ brand: "Apple" }],
  },
  {
    slug: "anti-yellow-clear-case-galaxy",
    type: "anti-yellow",
    sku: "CC-AY-SG-01",
    category: "cases-covers",
    nameEn: "Anti-Yellow Clear Case (Galaxy S & A)",
    nameHi: "एंटी-येलो क्लियर केस (Galaxy S और A)",
    summaryEn: "Clear case that won't turn yellow, for Galaxy S and A series.",
    summaryHi: "Galaxy S और A सीरीज़ के लिए पीला न होने वाला क्लियर केस।",
    descriptionEn: "UV-resistant clear back with shock-absorbing corners.",
    price: 499,
    mrp: 999,
    stock: 50,
    specs: [["Material", "PC + TPU"], ["Anti-yellowing", "UV-resistant coating"]],
    fits: [{ brand: "Samsung", models: [...SAMSUNG_S, ...SAMSUNG_A] }],
  },
  {
    slug: "soft-tpu-back-cover-iphone",
    type: "normal-silicone",
    sku: "CC-NS-IP-01",
    category: "cases-covers",
    nameEn: "Soft Silicone (TPU) Back Cover (iPhone)",
    nameHi: "सॉफ़्ट सिलिकॉन (TPU) बैक कवर (iPhone)",
    summaryEn: "Light, flexible everyday cover with raised edges.",
    summaryHi: "हल्का, लचीला रोज़मर्रा का कवर, उभरे किनारों के साथ।",
    descriptionEn: "1.2 mm soft TPU in black or transparent. Raised lip around the camera and screen.",
    price: 249,
    mrp: 499,
    stock: 140,
    specs: [["Material", "TPU"], ["Thickness", "1.2 mm"]],
    fits: [{ brand: "Apple" }],
  },
  {
    slug: "soft-tpu-back-cover-android",
    type: "normal-silicone",
    sku: "CC-NS-AN-01",
    category: "cases-covers",
    nameEn: "Soft Silicone (TPU) Back Cover (Android)",
    nameHi: "सॉफ़्ट सिलिकॉन (TPU) बैक कवर (Android)",
    summaryEn: "Budget back cover for Redmi, Realme, Vivo, Oppo, Samsung and more.",
    summaryHi: "Redmi, Realme, Vivo, Oppo, Samsung और भी के लिए किफ़ायती बैक कवर।",
    descriptionEn: "Flexible TPU with camera protection lip, cut for your exact model.",
    price: 199,
    mrp: 399,
    stock: 200,
    specs: [["Material", "TPU"], ["Thickness", "1.2 mm"]],
    fits: [{ brand: "Xiaomi" }, { brand: "Poco" }, { brand: "Realme" }, { brand: "Vivo" }, { brand: "Oppo" }, { brand: "iQOO" }, { brand: "Samsung" }, { brand: "Motorola" }, { brand: "Infinix" }, { brand: "Tecno" }],
  },
  // Screen protectors
  {
    slug: "armourglass-9h-tempered-glass-iphone",
    type: "edge-to-edge",
    sku: "SP-TG-IP-01",
    category: "screen-protectors",
    nameEn: "ArmourGlass 9H Tempered Glass (iPhone)",
    nameHi: "आर्मरग्लास 9H टेम्पर्ड ग्लास (iPhone)",
    summaryEn: "Edge-to-edge 9H glass with an easy-fit alignment frame.",
    summaryHi: "आसान फ़िटिंग फ़्रेम के साथ एज-टू-एज 9H ग्लास।",
    descriptionEn:
      "0.33 mm tempered glass with an oleophobic coating that resists fingerprints. The alignment frame makes bubble-free installation easy at home, and Face ID and the earpiece stay fully open.\n\nIn the box: 2 glass sheets, alignment frame, wet and dry wipes, dust stickers.",
    price: 499,
    mrp: 999,
    stock: 64,
    featured: true,
    specs: [["Hardness", "9H"], ["Thickness", "0.33 mm"], ["Coverage", "Edge-to-edge"], ["Pack", "2 sheets + frame"]],
    fits: [{ brand: "Apple", models: [...IPHONE_RECENT, ...IPHONE_OLDER] }],
  },
  {
    slug: "privacy-shield-glass-iphone",
    type: "privacy",
    sku: "SP-PV-IP-01",
    category: "screen-protectors",
    nameEn: "PrivacyShield Anti-Spy Glass (iPhone)",
    nameHi: "प्राइवेसीशील्ड एंटी-स्पाई ग्लास (iPhone)",
    summaryEn: "Screen looks dark from the sides — perfect for metro and office.",
    summaryHi: "साइड से स्क्रीन काली दिखती है — मेट्रो और ऑफ़िस के लिए बढ़िया।",
    descriptionEn: "A 28° privacy filter keeps your chats and banking apps private while the screen stays clear head-on. 9H hardness with a scratch-resistant top layer.",
    price: 799,
    mrp: 1299,
    stock: 4,
    specs: [["Viewing angle", "28° privacy"], ["Hardness", "9H"], ["Thickness", "0.4 mm"]],
    fits: [{ brand: "Apple", models: IPHONE_RECENT }],
  },
  {
    slug: "matte-paperfeel-glass-android",
    type: "matte",
    sku: "SP-MT-AN-01",
    category: "screen-protectors",
    nameEn: "Matte Anti-Glare Glass (Samsung & OnePlus)",
    nameHi: "मैट एंटी-ग्लेयर ग्लास (Samsung और OnePlus)",
    summaryEn: "Smooth matte finish that cuts glare outdoors and keeps fingerprints away.",
    summaryHi: "बाहर चमक कम करने वाली स्मूद मैट फ़िनिश, उंगलियों के निशान नहीं।",
    descriptionEn: "Ideal for gamers: the matte surface reduces reflections and makes swipes feel smooth even in long sessions. Works with in-display fingerprint sensors.",
    price: 449,
    mrp: 799,
    stock: 38,
    specs: [["Finish", "Matte anti-glare"], ["Hardness", "9H"], ["Fingerprint sensor", "Supported"]],
    fits: [{ brand: "Samsung", models: [...SAMSUNG_S, ...SAMSUNG_A] }, { brand: "OnePlus" }],
  },
  {
    slug: "uv-curved-glass-galaxy-ultra",
    type: "uv-curved",
    sku: "SP-UV-SS-01",
    category: "screen-protectors",
    nameEn: "UV Liquid Curved Glass (Galaxy Ultra)",
    nameHi: "UV लिक्विड कर्व्ड ग्लास (Galaxy Ultra)",
    summaryEn: "Full-adhesive UV glass for curved and flat flagship displays.",
    summaryHi: "कर्व्ड और फ़्लैट फ़्लैगशिप डिस्प्ले के लिए फ़ुल-एडहेसिव UV ग्लास।",
    descriptionEn: "Liquid UV adhesive fills every gap so the glass bonds completely — no halo effect and full touch sensitivity. Kit includes a UV lamp.",
    price: 999,
    mrp: 1599,
    stock: 0,
    specs: [["Adhesive", "UV liquid, full coverage"], ["Hardness", "9H"], ["Includes", "UV lamp, 2 glass"]],
    fits: [{ brand: "Samsung", models: ["Galaxy S24 Ultra", "Galaxy S25 Ultra", "Galaxy S23"] }],
  },
  {
    slug: "clearguard-glass-budget-android",
    type: "normal-clear",
    sku: "SP-TG-AN-02",
    category: "screen-protectors",
    nameEn: "ClearGuard Tempered Glass (Redmi, Realme, Vivo, Oppo)",
    nameHi: "क्लियरगार्ड टेम्पर्ड ग्लास (Redmi, Realme, Vivo, Oppo)",
    summaryEn: "Everyday HD glass protection at a great price.",
    summaryHi: "बढ़िया कीमत में रोज़ाना HD ग्लास सुरक्षा।",
    descriptionEn: "HD-clear 2.5D glass with rounded edges that won't chip. Pack of two.",
    price: 299,
    mrp: 599,
    stock: 120,
    specs: [["Hardness", "9H"], ["Edges", "2.5D rounded"], ["Pack", "2 sheets"]],
    fits: [{ brand: "Xiaomi" }, { brand: "Poco" }, { brand: "Realme" }, { brand: "Vivo" }, { brand: "Oppo" }, { brand: "iQOO" }],
  },
  {
    slug: "ipad-paper-texture-screen-guard",
    type: "matte",
    sku: "SP-PT-IPD-01",
    category: "screen-protectors",
    nameEn: "PaperTouch Screen Guard (iPad)",
    nameHi: "पेपरटच स्क्रीन गार्ड (iPad)",
    summaryEn: "Paper-like texture for drawing and note-taking with Apple Pencil.",
    summaryHi: "Apple Pencil से ड्रॉइंग और नोट्स के लिए पेपर जैसी बनावट।",
    descriptionEn: "Adds a gentle drag to your stylus for natural writing control while reducing glare.",
    price: 899,
    mrp: 1499,
    stock: 15,
    specs: [["Texture", "Paper-like"], ["Material", "PET film"], ["Pencil", "Compatible"]],
    fits: [{ brand: "Apple", category: "tablet" }],
  },
  // Cases
  {
    slug: "airflex-clear-magsafe-case-iphone",
    type: "magsafe",
    sku: "CS-CL-IP-01",
    category: "cases-covers",
    nameEn: "AirFlex Clear MagSafe Case (iPhone)",
    nameHi: "एयरफ़्लेक्स क्लियर MagSafe केस (iPhone)",
    summaryEn: "Crystal-clear, anti-yellowing case with built-in magnets.",
    summaryHi: "बिल्ट-इन मैग्नेट वाला क्रिस्टल-क्लियर, पीला न पड़ने वाला केस।",
    descriptionEn: "Shows off your iPhone's colour while protecting it from 2 m drops. Built-in magnet ring for MagSafe chargers and wallets. Raised lips around the screen and cameras.",
    price: 1299,
    mrp: 2199,
    stock: 42,
    featured: true,
    specs: [["Drop protection", "2 m"], ["MagSafe", "Yes, N52 magnets"], ["Material", "Polycarbonate + TPU"]],
    fits: [{ brand: "Apple", models: IPHONE_RECENT }],
  },
  {
    slug: "rugged-armour-case-galaxy",
    type: "rugged",
    sku: "CS-RG-SS-01",
    category: "cases-covers",
    nameEn: "Rugged Armour Case with Kickstand (Galaxy)",
    nameHi: "किकस्टैंड वाला रग्ड आर्मर केस (Galaxy)",
    summaryEn: "Military-grade drop protection with a built-in stand.",
    summaryHi: "बिल्ट-इन स्टैंड के साथ मिलिट्री-ग्रेड ड्रॉप सुरक्षा।",
    descriptionEn: "Dual-layer construction with air-cushion corners. The metal kickstand holds your phone in landscape for videos.",
    price: 999,
    mrp: 1799,
    stock: 3,
    specs: [["Drop protection", "3 m (MIL-STD-810G)"], ["Kickstand", "Metal, landscape"], ["Layers", "TPU + PC"]],
    fits: [{ brand: "Samsung", models: [...SAMSUNG_S, ...SAMSUNG_A] }],
  },
  {
    slug: "silicone-soft-touch-case-iphone",
    type: "liquid-silicone",
    sku: "CS-SI-IP-02",
    category: "cases-covers",
    nameEn: "Soft-Touch Silicone Case (iPhone)",
    nameHi: "सॉफ़्ट-टच सिलिकॉन केस (iPhone)",
    summaryEn: "Silky liquid silicone with a microfibre lining.",
    summaryHi: "माइक्रोफ़ाइबर लाइनिंग के साथ मुलायम लिक्विड सिलिकॉन।",
    descriptionEn: "Comfortable grip, available in seasonal colours. Microfibre inside keeps the back glass scratch-free.",
    price: 699,
    mrp: 1199,
    stock: 55,
    specs: [["Material", "Liquid silicone"], ["Lining", "Microfibre"], ["Wireless charging", "Supported"]],
    fits: [{ brand: "Apple", models: [...IPHONE_RECENT, ...IPHONE_OLDER] }],
  },
  {
    slug: "flip-wallet-case-android",
    type: "flip-wallet",
    sku: "CS-FW-AN-01",
    category: "cases-covers",
    nameEn: "Vegan Leather Flip Wallet Case",
    nameHi: "वीगन लेदर फ़्लिप वॉलेट केस",
    summaryEn: "Card slots, magnetic closure and full-body protection.",
    summaryHi: "कार्ड स्लॉट, मैग्नेटिक क्लोज़र और पूरी बॉडी की सुरक्षा।",
    descriptionEn: "Holds three cards and cash. The cover folds into a stand for hands-free viewing.",
    price: 799,
    mrp: 1399,
    stock: 22,
    specs: [["Material", "PU vegan leather"], ["Card slots", "3"], ["Stand", "Yes"]],
    fits: [{ brand: "Xiaomi" }, { brand: "Samsung", models: SAMSUNG_A }, { brand: "Vivo" }, { brand: "Oppo" }, { brand: "Realme" }],
  },
  {
    slug: "slim-matte-case-pixel",
    type: "slim-matte",
    sku: "CS-SM-PX-01",
    category: "cases-covers",
    nameEn: "UltraSlim Matte Case (Pixel & Nothing)",
    nameHi: "अल्ट्रास्लिम मैट केस (Pixel और Nothing)",
    summaryEn: "0.8 mm thin, fingerprint-free matte shell.",
    summaryHi: "0.8 mm पतला, फ़िंगरप्रिंट-फ़्री मैट शेल।",
    descriptionEn: "For people who hate bulky cases: protects against scratches and minor bumps without adding weight.",
    price: 599,
    stock: 18,
    specs: [["Thickness", "0.8 mm"], ["Finish", "Frosted matte"], ["Weight", "12 g"]],
    fits: [{ brand: "Google" }, { brand: "Nothing" }],
  },
  {
    slug: "foldguard-hinge-case-galaxy-z",
    type: "rugged",
    sku: "CS-FD-SS-01",
    category: "cases-covers",
    nameEn: "FoldGuard Hinge Protection Case (Galaxy Z)",
    nameHi: "फ़ोल्डगार्ड हिंज प्रोटेक्शन केस (Galaxy Z)",
    summaryEn: "Covers the hinge on Samsung foldables.",
    summaryHi: "Samsung फ़ोल्डेबल के हिंज को कवर करता है।",
    descriptionEn: "Two-piece case with a sliding hinge guard that keeps dust out and protects the fold when closed.",
    price: 1899,
    mrp: 2999,
    stock: 7,
    specs: [["Hinge cover", "Sliding"], ["Material", "PC + TPU"]],
    fits: [{ brand: "Samsung", models: ["Galaxy Z Flip 6", "Galaxy Z Fold 6"] }],
  },
  {
    slug: "ipad-smart-folio-case",
    type: "flip-wallet",
    sku: "CS-FO-IPD-01",
    category: "cases-covers",
    nameEn: "Smart Folio Case with Pencil Holder (iPad)",
    nameHi: "पेंसिल होल्डर वाला स्मार्ट फ़ोलियो केस (iPad)",
    summaryEn: "Auto sleep/wake cover that folds into a stand.",
    summaryHi: "ऑटो स्लीप/वेक कवर जो स्टैंड बन जाता है।",
    descriptionEn: "Trifold cover with auto sleep/wake, a soft back and a slot for your stylus.",
    price: 1499,
    mrp: 2499,
    stock: 12,
    specs: [["Auto sleep/wake", "Yes"], ["Pencil holder", "Yes"]],
    fits: [{ brand: "Apple", category: "tablet" }, { brand: "Samsung", category: "tablet" }],
  },
  // Camera protectors
  {
    slug: "lensguard-camera-ring-iphone-pro",
    type: "metal-ring",
    sku: "CP-RG-IP-01",
    category: "camera-protectors",
    nameEn: "LensGuard Aluminium Camera Rings (iPhone Pro)",
    nameHi: "लेंसगार्ड एल्युमिनियम कैमरा रिंग (iPhone Pro)",
    summaryEn: "Individual sapphire-coated lens rings that match your phone.",
    summaryHi: "आपके फ़ोन से मेल खाते सफ़ायर-कोटेड लेंस रिंग।",
    descriptionEn: "Each lens gets its own aluminium ring with anti-reflective glass, so night photos stay flare-free.",
    price: 599,
    mrp: 999,
    stock: 31,
    featured: true,
    specs: [["Material", "Aluminium + AR glass"], ["Flash", "Fully open"], ["Night mode", "No flare"]],
    fits: [{ brand: "Apple", models: ["iPhone 15 Pro", "iPhone 15 Pro Max", "iPhone 16 Pro", "iPhone 16 Pro Max"] }],
  },
  {
    slug: "clear-camera-lens-glass-android",
    type: "lens-glass",
    sku: "CP-CL-AN-01",
    category: "camera-protectors",
    nameEn: "Clear Camera Lens Glass (Android flagships)",
    nameHi: "क्लियर कैमरा लेंस ग्लास (Android फ़्लैगशिप)",
    summaryEn: "One-piece clear glass that covers the whole camera island.",
    summaryHi: "पूरे कैमरा आइलैंड को कवर करने वाला वन-पीस क्लियर ग्लास।",
    descriptionEn: "Ultra-thin 9H glass cut for each phone's camera layout. Pack of two.",
    price: 349,
    mrp: 599,
    stock: 2,
    specs: [["Hardness", "9H"], ["Pack", "2"]],
    fits: [{ brand: "Samsung", models: SAMSUNG_S }, { brand: "OnePlus" }, { brand: "Google" }, { brand: "Vivo", models: ["X200", "V40"] }],
  },
  // Chargers & cables
  {
    slug: "voltflow-35w-dual-usb-c-charger",
    sku: "CH-35-UC-01",
    category: "chargers-cables",
    nameEn: "VoltFlow 35W Dual USB-C GaN Charger",
    nameHi: "वोल्टफ़्लो 35W डुअल USB-C GaN चार्जर",
    summaryEn: "Charge a phone and earbuds together, safely and fast.",
    summaryHi: "फ़ोन और ईयरबड्स को एक साथ, सुरक्षित और तेज़ चार्ज करें।",
    descriptionEn: "GaN technology keeps it compact and cool. Smart power sharing, BIS certified, with over-voltage and temperature protection.",
    price: 1499,
    mrp: 2499,
    stock: 26,
    featured: true,
    universal: true,
    specs: [["Output", "35W max (PD 3.0, PPS)"], ["Ports", "2 × USB-C"], ["Certification", "BIS"]],
  },
  {
    slug: "braided-usb-c-to-c-cable-2m",
    sku: "CB-CC-2M-01",
    category: "chargers-cables",
    nameEn: "Braided USB-C to USB-C Cable (2 m, 100W)",
    nameHi: "ब्रेडेड USB-C से USB-C केबल (2 मीटर, 100W)",
    summaryEn: "Tough nylon braid tested for 30,000 bends.",
    summaryHi: "30,000 बार मोड़ने पर टेस्ट किया गया मज़बूत नायलॉन ब्रेड।",
    descriptionEn: "Supports up to 100W charging for phones, tablets and laptops plus 480 Mbps data.",
    price: 499,
    mrp: 899,
    stock: 80,
    universal: true,
    specs: [["Length", "2 m"], ["Power", "Up to 100W"], ["Bend test", "30,000+"]],
  },
  {
    slug: "usb-c-to-lightning-cable-mfi",
    sku: "CB-CL-1M-01",
    category: "chargers-cables",
    nameEn: "USB-C to Lightning Cable, MFi Certified (1 m)",
    nameHi: "USB-C से लाइटनिंग केबल, MFi सर्टिफ़ाइड (1 मीटर)",
    summaryEn: "Fast-charge older iPhones with an Apple-certified cable.",
    summaryHi: "Apple-सर्टिफ़ाइड केबल से पुराने iPhone तेज़ी से चार्ज करें।",
    descriptionEn: "Apple MFi certification means no 'accessory not supported' warnings. Supports fast charging with a 20W+ adapter.",
    price: 899,
    mrp: 1499,
    stock: 0,
    specs: [["Certification", "Apple MFi"], ["Length", "1 m"]],
    fits: [{ brand: "Apple", models: IPHONE_OLDER }],
  },
  {
    slug: "magcharge-15w-magnetic-wireless-pad",
    sku: "CH-WL-15-01",
    category: "chargers-cables",
    nameEn: "MagCharge 15W Magnetic Wireless Charger",
    nameHi: "मैगचार्ज 15W मैग्नेटिक वायरलेस चार्जर",
    summaryEn: "Snaps on and charges — no more misaligned phones overnight.",
    summaryHi: "चिपकाएँ और चार्ज करें — रात भर गलत जगह रखा फ़ोन नहीं।",
    descriptionEn: "Strong magnets keep alignment perfect. Works through MagSafe cases up to 3 mm thick.",
    price: 1199,
    mrp: 1999,
    stock: 9,
    specs: [["Output", "15W"], ["Magnetic", "Yes"], ["Case-friendly", "Up to 3 mm"]],
    fits: [{ brand: "Apple", models: [...IPHONE_RECENT, ...IPHONE_OLDER] }],
  },
  {
    slug: "laptop-65w-usb-c-gan-charger",
    sku: "CH-65-LP-01",
    category: "chargers-cables",
    nameEn: "65W USB-C GaN Laptop Charger",
    nameHi: "65W USB-C GaN लैपटॉप चार्जर",
    summaryEn: "One charger for your laptop, tablet and phone.",
    summaryHi: "लैपटॉप, टैबलेट और फ़ोन के लिए एक चार्जर।",
    descriptionEn: "Powers USB-C laptops including MacBook Air and most Windows ultrabooks. Foldable pins for travel.",
    price: 2299,
    mrp: 3499,
    stock: 14,
    universal: true,
    specs: [["Output", "65W PD"], ["Ports", "USB-C + USB-A"], ["Pins", "Foldable"]],
  },
  // Power banks
  {
    slug: "pocketcell-10000mah-slim-power-bank",
    sku: "PB-10K-01",
    category: "power-banks",
    nameEn: "PocketCell 10,000 mAh Slim Power Bank (22.5W)",
    nameHi: "पॉकेटसेल 10,000 mAh स्लिम पावर बैंक (22.5W)",
    summaryEn: "Two full phone charges in a pocket-sized body.",
    summaryHi: "पॉकेट साइज़ में दो बार फ़ुल फ़ोन चार्ज।",
    descriptionEn: "Lithium-polymer cells with 12-layer protection. Charges two devices at once.",
    price: 1299,
    mrp: 2199,
    stock: 33,
    featured: true,
    universal: true,
    specs: [["Capacity", "10,000 mAh"], ["Output", "22.5W"], ["Weight", "205 g"]],
  },
  {
    slug: "pocketcell-20000mah-power-bank-pd",
    sku: "PB-20K-01",
    category: "power-banks",
    nameEn: "PocketCell 20,000 mAh Power Bank (PD 30W)",
    nameHi: "पॉकेटसेल 20,000 mAh पावर बैंक (PD 30W)",
    summaryEn: "Fast charges phones and tablets for a whole weekend.",
    summaryHi: "पूरे वीकेंड के लिए फ़ोन और टैबलेट तेज़ी से चार्ज करें।",
    descriptionEn: "30W USB-C Power Delivery in and out, with an LED percentage display.",
    price: 2199,
    mrp: 3299,
    stock: 5,
    universal: true,
    specs: [["Capacity", "20,000 mAh"], ["Output", "30W PD"], ["Display", "LED %"]],
  },
  {
    slug: "magsafe-battery-pack-5000",
    sku: "PB-MG-5K-01",
    category: "power-banks",
    nameEn: "MagSnap 5,000 mAh Magnetic Battery Pack",
    nameHi: "मैगस्नैप 5,000 mAh मैग्नेटिक बैटरी पैक",
    summaryEn: "Snaps to the back of your iPhone for top-ups on the go.",
    summaryHi: "चलते-चलते चार्ज के लिए iPhone के पीछे चिपक जाता है।",
    descriptionEn: "Wireless magnetic charging plus a USB-C port. Slim enough to keep attached in your pocket.",
    price: 1799,
    mrp: 2799,
    stock: 0,
    specs: [["Capacity", "5,000 mAh"], ["Wireless", "Magnetic 7.5W"]],
    fits: [{ brand: "Apple", models: [...IPHONE_RECENT, "iPhone 12", "iPhone 13", "iPhone 14"] }],
  },
  // Earbud cases
  {
    slug: "airpods-pro-silicone-case-keychain",
    sku: "EC-AP-SI-01",
    category: "earbud-cases",
    nameEn: "Silicone Case with Keychain (AirPods Pro)",
    nameHi: "कीचेन के साथ सिलिकॉन केस (AirPods Pro)",
    summaryEn: "Shock-absorbing case with front LED visible.",
    summaryHi: "शॉक-एब्ज़ॉर्बिंग केस, सामने की LED दिखती है।",
    descriptionEn: "Supports wireless charging and comes with a carabiner keychain.",
    price: 399,
    mrp: 699,
    stock: 27,
    specs: [["Material", "Silicone"], ["Wireless charging", "Supported"]],
    fits: [{ brand: "Apple", category: "audio" }],
  },
  {
    slug: "hard-shell-earbud-case-galaxy-buds",
    sku: "EC-GB-HS-01",
    category: "earbud-cases",
    nameEn: "Hard-Shell Case (Galaxy Buds & OnePlus Buds)",
    nameHi: "हार्ड-शेल केस (Galaxy Buds और OnePlus Buds)",
    summaryEn: "Scratch-proof hard shell with soft inner lining.",
    summaryHi: "मुलायम अंदरूनी लाइनिंग के साथ स्क्रैच-प्रूफ़ हार्ड शेल।",
    descriptionEn: "Precise cut-outs for the charging port and pairing button.",
    price: 449,
    stock: 11,
    specs: [["Material", "PC + TPU lining"]],
    fits: [{ brand: "Samsung", category: "audio" }, { brand: "OnePlus", category: "audio" }],
  },
  // Cleaning kits
  {
    slug: "screen-care-cleaning-kit",
    sku: "CK-SC-01",
    category: "cleaning-kits",
    nameEn: "ScreenCare 3-in-1 Cleaning Kit",
    nameHi: "स्क्रीनकेयर 3-इन-1 क्लीनिंग किट",
    summaryEn: "Alcohol-free spray, microfibre cloth and soft brush.",
    summaryHi: "अल्कोहल-फ़्री स्प्रे, माइक्रोफ़ाइबर कपड़ा और मुलायम ब्रश।",
    descriptionEn: "Safe for oleophobic coatings, OLED screens and camera lenses. 100 ml spray lasts months.",
    price: 349,
    mrp: 599,
    stock: 70,
    universal: true,
    specs: [["Spray", "100 ml, alcohol-free"], ["Cloth", "Microfibre 20×20 cm"]],
  },
  {
    slug: "port-cleaning-tool-set",
    sku: "CK-PT-01",
    category: "cleaning-kits",
    nameEn: "Port & Speaker Cleaning Tool Set",
    nameHi: "पोर्ट और स्पीकर क्लीनिंग टूल सेट",
    summaryEn: "Fix 'loose' charging and muffled speakers caused by lint.",
    summaryHi: "धूल से होने वाली ढीली चार्जिंग और धीमे स्पीकर ठीक करें।",
    descriptionEn: "Non-conductive picks, brushes and cleaning putty for charging ports, speaker grilles and earbuds. Our technicians' favourite first fix before booking a port repair.",
    price: 249,
    stock: 4,
    universal: true,
    specs: [["Pieces", "12"], ["Material", "Non-conductive"]],
  },
  // Laptop sleeves
  {
    slug: "commuter-padded-laptop-sleeve-14",
    sku: "LS-14-01",
    category: "laptop-sleeves",
    nameEn: "Commuter Padded Laptop Sleeve (13–14\")",
    nameHi: "कम्यूटर पैडेड लैपटॉप स्लीव (13–14\")",
    summaryEn: "Water-resistant shell with corner bumpers and an accessory pocket.",
    summaryHi: "कोनों पर बम्पर और एक्सेसरी पॉकेट वाला वॉटर-रेज़िस्टेंट शेल।",
    descriptionEn: "Fits MacBook Air, 14\" ultrabooks and iPad Pro. Front pocket fits a charger and mouse.",
    price: 1199,
    mrp: 1999,
    stock: 19,
    featured: true,
    specs: [["Fits", "13–14 inch"], ["Water resistance", "Splash-proof"], ["Padding", "6 mm foam"]],
    fits: [{ brand: "Apple", models: ["MacBook Air M2", "MacBook Air M3", "MacBook Pro 14"] }, { brand: "Dell", models: ["XPS 13"] }, { brand: "Lenovo", models: ["ThinkPad E14"] }, { brand: "Asus", models: ["Zenbook 14"] }],
  },
  {
    slug: "commuter-padded-laptop-sleeve-16",
    sku: "LS-16-01",
    category: "laptop-sleeves",
    nameEn: "Commuter Padded Laptop Sleeve (15.6–16\")",
    nameHi: "कम्यूटर पैडेड लैपटॉप स्लीव (15.6–16\")",
    summaryEn: "Roomy sleeve for gaming and work laptops.",
    summaryHi: "गेमिंग और काम वाले लैपटॉप के लिए बड़ी स्लीव।",
    descriptionEn: "Extra-thick padding for heavier laptops, with a luggage strap for trolleys.",
    price: 1399,
    mrp: 2299,
    stock: 1,
    specs: [["Fits", "15.6–16 inch"], ["Padding", "8 mm foam"], ["Trolley strap", "Yes"]],
    fits: [{ brand: "HP" }, { brand: "Dell", models: ["Inspiron 15", "Vostro 15"] }, { brand: "Lenovo", models: ["IdeaPad Slim 5", "Legion 5"] }, { brand: "Asus", models: ["Vivobook 15", "ROG Strix G16"] }, { brand: "Acer" }],
  },
  {
    slug: "macbook-hard-shell-skin",
    sku: "LS-MB-HS-01",
    category: "laptop-sleeves",
    nameEn: "Frosted Hard-Shell Skin (MacBook)",
    nameHi: "फ़्रॉस्टेड हार्ड-शेल स्किन (MacBook)",
    summaryEn: "Snap-on shell that keeps your MacBook scratch-free.",
    summaryHi: "स्नैप-ऑन शेल जो MacBook को खरोंच से बचाता है।",
    descriptionEn: "Two-piece frosted shell with ventilation and rubber feet.",
    price: 1099,
    stock: 8,
    specs: [["Pieces", "Top + bottom"], ["Finish", "Frosted"]],
    fits: [{ brand: "Apple", category: "laptop" }],
  },
];

async function modelIdsFor(db: PrismaClient, fits: Fits[] = []) {
  const ids = new Set<string>();
  for (const f of fits) {
    const models = await db.deviceModel.findMany({
      where: {
        brand: { name: f.brand },
        ...(f.models ? { name: { in: f.models } } : {}),
        ...(f.category ? { category: { slug: f.category } } : f.models ? {} : { category: { slug: "phone" } }),
      },
      select: { id: true },
    });
    for (const m of models) ids.add(m.id);
  }
  return [...ids];
}

/**
 * `onlyNew`: production deploys add catalogue items that don't exist yet (by slug) and never touch
 * existing ones, so the owner's edits to prices, stock and copy survive every deploy.
 */
export async function seedShop(db: PrismaClient, { onlyNew = false } = {}) {
  const ALL = [...PRODUCTS, ...PRODUCT_ADDITIONS];
  const categoryIds = new Map<string, string>();
  let order = 0;
  for (const [slug, nameEn, nameHi, descriptionEn, descriptionHi] of CATEGORIES) {
    const c = await db.productCategory.upsert({
      where: { slug },
      create: { slug, nameEn, nameHi, descriptionEn, descriptionHi, sortOrder: order++ },
      update: onlyNew ? {} : { nameEn, nameHi, descriptionEn, descriptionHi },
    });
    categoryIds.set(slug, c.id);
  }

  const typeIds = new Map<string, string>();
  const typeOrder = new Map<string, number>();
  for (const [category, slug, nameEn, nameHi, descriptionEn, descriptionHi, highlights] of TYPES) {
    const categoryId = categoryIds.get(category)!;
    const sortOrder = typeOrder.get(category) ?? 0;
    typeOrder.set(category, sortOrder + 1);
    const data = { nameEn, nameHi, descriptionEn, descriptionHi, highlights };
    const t = await db.productType.upsert({
      where: { categoryId_slug: { categoryId, slug } },
      create: { categoryId, slug, sortOrder, ...data },
      update: onlyNew ? {} : data,
    });
    typeIds.set(`${category}/${slug}`, t.id);
  }

  let added = 0;
  for (const p of ALL) {
    if (onlyNew && (await db.product.count({ where: { slug: p.slug } }))) continue;
    added++;
    const data = {
      sku: p.sku,
      nameEn: p.nameEn,
      nameHi: p.nameHi,
      summaryEn: p.summaryEn,
      summaryHi: p.summaryHi,
      descriptionEn: p.descriptionEn,
      categoryId: categoryIds.get(p.category)!,
      typeId: p.type ? typeIds.get(`${p.category}/${p.type}`)! : null,
      pricePaise: p.price * 100,
      mrpPaise: p.mrp ? p.mrp * 100 : null,
      status: "ACTIVE" as const,
      featured: !!p.featured,
      universal: !!p.universal,
      specs: p.specs.map(([labelEn, value, labelHi]) => ({ labelEn, labelHi: labelHi ?? "", value })),
    };
    const existing = await db.product.findUnique({ where: { slug: p.slug }, select: { id: true } });
    const product = existing ? await db.product.update({ where: { id: existing.id }, data }) : await db.product.create({ data: { slug: p.slug, ...data } });

    const modelIds = await modelIdsFor(db, p.fits);
    await db.productDeviceCompatibility.deleteMany({ where: { productId: product.id } });
    if (modelIds.length) await db.productDeviceCompatibility.createMany({ data: modelIds.map((deviceModelId) => ({ productId: product.id, deviceModelId })) });

    if (!existing) {
      await db.inventoryBalance.create({ data: { productId: product.id, onHand: p.stock } });
      if (p.stock > 0) {
        await db.inventoryMovement.create({ data: { productId: product.id, delta: p.stock, balance: p.stock, reason: "RECEIVED", note: "Opening stock (seed)", actorId: "seed" } });
      }
    }
  }
  console.log(`Shop: ${CATEGORIES.length} categories, ${TYPES.length} product types, ${added} of ${ALL.length} products written.`);
}
