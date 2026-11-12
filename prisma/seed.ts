/**
 * Seed reference data and (outside production) demo accounts.
 * Safe to re-run: everything is upserted.
 *
 *   npm run db:seed
 *   SEED_MODE=deploy …   (Vercel build: roles, owner bootstrap and switch defaults every deploy;
 *                          catalogue and sample content only into an empty database; demo users only
 *                          with SEED_TEST_USERS=true, which also requires SEED_DEMO_PASSWORD)
 */
import "./load-env";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { directDatabaseUrl } from "../src/server/db-url";
import { PERMISSIONS, ROLE_DEFINITIONS, ROLE_KEYS } from "../src/server/rbac/permissions";
import { deviceSlug, OTHER_BRAND_NAME, OTHER_MODEL_NAME } from "../src/lib/device-name";
import { seedContent } from "./seed/content";
import { seedCustomization } from "./seed/customization";
import { PHONES, phoneAliases } from "./seed/devices";
import { seedRepairEstimates } from "./seed/repair-estimates";
import { seedShop } from "./seed/shop";
import { seedContentImages, seedProductImages } from "./seed/product-images";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: directDatabaseUrl() }) });
const isDeploy = process.env.SEED_MODE === "deploy";
const isProd = process.env.NODE_ENV === "production" || isDeploy;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function seedRbac() {
  for (const key of PERMISSIONS) await db.permission.upsert({ where: { key }, create: { key }, update: {} });
  const perms = await db.permission.findMany();
  const permId = new Map(perms.map((p) => [p.key, p.id]));
  for (const key of ROLE_KEYS) {
    const def = ROLE_DEFINITIONS[key];
    const role = await db.role.upsert({ where: { key }, create: { key, name: def.name, description: def.description }, update: { name: def.name, description: def.description } });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: def.permissions.map((p) => ({ roleId: role.id, permissionId: permId.get(p)! })) });
  }
}

/** Sample Jaipur pincodes (D-09: the Owner maintains the real list in Admin → Settings). */
const JAIPUR_AREAS: [string, string][] = [
  ["302001", "MI Road / Jaipur GPO"],
  ["302002", "Chandpole"],
  ["302003", "Johari Bazaar"],
  ["302004", "Raja Park / Adarsh Nagar"],
  ["302005", "Bani Park"],
  ["302006", "Civil Lines"],
  ["302012", "Jhotwara"],
  ["302015", "Gandhi Nagar / Bapu Nagar"],
  ["302016", "Shastri Nagar"],
  ["302017", "Malviya Nagar"],
  ["302018", "Tonk Road / Durgapura"],
  ["302019", "Shyam Nagar"],
  ["302020", "Mansarovar"],
  ["302021", "Vaishali Nagar"],
  ["302022", "Sitapura"],
  ["302023", "Vidhyadhar Nagar"],
  ["302033", "Pratap Nagar"],
  ["302039", "Murlipura"],
];

const CATALOG = {
  phone: {
    nameEn: "Mobile phone",
    nameHi: "मोबाइल फ़ोन",
    brands: Object.fromEntries(Object.entries(PHONES).map(([brand, models]) => [brand, models.map(([name]) => name)])),
    issues: [
      ["Broken or cracked screen", "टूटी या चटकी स्क्रीन"],
      ["Battery drains fast / not charging", "बैटरी जल्दी ख़त्म / चार्ज नहीं होती"],
      ["Charging port problem", "चार्जिंग पोर्ट की समस्या"],
      ["Camera not working", "कैमरा काम नहीं कर रहा"],
      ["Speaker or microphone problem", "स्पीकर या माइक्रोफ़ोन की समस्या"],
      ["Water or liquid damage", "पानी या तरल से नुकसान"],
      ["Back glass broken", "पीछे का ग्लास टूटा"],
      ["Software / not turning on", "सॉफ़्टवेयर / चालू नहीं हो रहा"],
    ],
  },
  tablet: {
    nameEn: "Tablet",
    nameHi: "टैबलेट",
    brands: { Apple: ["iPad (10th gen)", "iPad Air", "iPad Pro 11", "iPad mini"], Samsung: ["Galaxy Tab S9", "Galaxy Tab S9 FE", "Galaxy Tab A9"], Xiaomi: ["Pad 6"], OnePlus: ["OnePlus Pad", "OnePlus Pad Go"], Lenovo: ["Tab M11", "Tab P12"] },
    issues: [
      ["Broken or cracked screen", "टूटी या चटकी स्क्रीन"],
      ["Battery or charging problem", "बैटरी या चार्जिंग की समस्या"],
      ["Software / not turning on", "सॉफ़्टवेयर / चालू नहीं हो रहा"],
    ],
  },
  laptop: {
    nameEn: "Laptop",
    nameHi: "लैपटॉप",
    brands: { Apple: ["MacBook Air M2", "MacBook Air M3", "MacBook Pro 14"], Dell: ["Inspiron 15", "XPS 13", "Vostro 15"], HP: ["Pavilion 15", "Victus 16", "Envy x360"], Lenovo: ["IdeaPad Slim 5", "ThinkPad E14", "Legion 5"], Asus: ["Vivobook 15", "ROG Strix G16", "Zenbook 14"], Acer: ["Aspire 7", "Nitro V"] },
    issues: [
      ["Screen damage", "स्क्रीन ख़राब"],
      ["Keyboard or trackpad problem", "कीबोर्ड या ट्रैकपैड की समस्या"],
      ["Battery or charging problem", "बैटरी या चार्जिंग की समस्या"],
      ["Slow / software problem", "धीमा / सॉफ़्टवेयर समस्या"],
      ["Liquid damage", "तरल से नुकसान"],
    ],
  },
  smartwatch: {
    nameEn: "Smartwatch",
    nameHi: "स्मार्टवॉच",
    brands: { Apple: ["Watch Series 9", "Watch Series 10", "Watch Ultra 2", "Watch SE"], Samsung: ["Galaxy Watch 6", "Galaxy Watch 7"], Noise: ["ColorFit Pro 5"], boAt: ["Wave Sigma"], OnePlus: ["Watch 2"] },
    issues: [
      ["Broken screen", "टूटी स्क्रीन"],
      ["Battery or charging problem", "बैटरी या चार्जिंग की समस्या"],
      ["Strap or button problem", "स्ट्रैप या बटन की समस्या"],
      ["Water damage", "पानी से नुकसान"],
    ],
  },
  audio: {
    nameEn: "Earbuds & audio",
    nameHi: "ईयरबड्स और ऑडियो",
    brands: { Apple: ["AirPods Pro (2nd gen)", "AirPods (4th gen)"], Samsung: ["Galaxy Buds 3 Pro"], OnePlus: ["Buds 3"], Sony: ["WF-1000XM5", "WH-1000XM5"], boAt: ["Airdopes 141"] },
    issues: [
      ["One side not working", "एक तरफ़ आवाज़ नहीं"],
      ["Charging case problem", "चार्जिंग केस की समस्या"],
      ["Battery drains fast", "बैटरी जल्दी ख़त्म"],
    ],
  },
} satisfies Record<string, { nameEn: string; nameHi: string; brands: Record<string, readonly string[]>; issues: readonly (readonly [string, string])[] }>;

/** Release year per model name (for sorting newest first); models listed in POPULAR show first in device pickers. */
const RELEASE_YEAR: Record<string, number> = {
  "iPhone 12": 2020, "iPhone 13": 2021, "iPhone 14": 2022, "iPhone 14 Plus": 2022, "iPhone 15": 2023, "iPhone 15 Plus": 2023, "iPhone 15 Pro": 2023, "iPhone 15 Pro Max": 2023,
  "iPhone 16": 2024, "iPhone 16 Plus": 2024, "iPhone 16 Pro": 2024, "iPhone 16 Pro Max": 2024,
  "Galaxy S23": 2023, "Galaxy S24": 2024, "Galaxy S24 Ultra": 2024, "Galaxy S25": 2025, "Galaxy S25 Ultra": 2025, "Galaxy Z Flip 6": 2024, "Galaxy Z Fold 6": 2024,
  "Galaxy A35": 2024, "Galaxy A55": 2024, "Galaxy M34": 2023, "Galaxy F55": 2024, "Pixel 8": 2023, "Pixel 8a": 2024, "Pixel 9": 2024, "Pixel 9 Pro": 2024,
  "OnePlus 11": 2023, "OnePlus 12": 2024, "OnePlus 13": 2025, "OnePlus Nord 4": 2024, "OnePlus Nord CE 4": 2024, "Redmi Note 13": 2024, "Redmi Note 13 Pro": 2024, "Redmi Note 14 Pro": 2025,
  "Xiaomi 14": 2024, "Poco X6 Pro": 2024, "Poco F6": 2024, "Phone (2)": 2023, "Phone (2a)": 2024, "iQOO 13": 2024, "Edge 50 Pro": 2024,
};
for (const models of Object.values(PHONES)) for (const [name, year] of models) RELEASE_YEAR[name] = year;
const FRAME = new Map(Object.values(PHONES).flatMap((models) => models.map(([name, , frame]) => [name, frame] as const)));
const POPULAR = new Set([
  "iPhone 16", "iPhone 16 Pro", "iPhone 15", "iPhone 14", "iPhone 13", "Galaxy S24 Ultra", "Galaxy S24", "Galaxy A55", "Pixel 9", "OnePlus 12", "OnePlus Nord CE 4",
  "Redmi Note 13 Pro", "Phone (2a)", "iPad (10th gen)", "MacBook Air M2", "Watch Series 9", "AirPods Pro (2nd gen)",
  ...Object.values(PHONES).flatMap((models) => models.filter((m) => m[3]).map(([name]) => name)),
]);

/** Slugs that predate `deviceSlug` (which spells "+" as "plus"); kept so existing URLs and links survive. */
const LEGACY_MODEL_SLUGS: Record<string, string> = { "F27 Pro+": "f27-pro" };

/** Deploys: add phone models that are new in PHONES (brands must already exist); existing rows are never touched. */
async function addNewPhoneModels() {
  const category = await db.deviceCategory.findUnique({ where: { slug: "phone" } });
  if (!category) return;
  let added = 0;
  for (const [brandName, models] of Object.entries(PHONES)) {
    const brand = await db.deviceBrand.findUnique({ where: { categoryId_slug: { categoryId: category.id, slug: slug(brandName) } } });
    if (!brand) continue;
    for (const [name] of models) {
      const modelSlug = LEGACY_MODEL_SLUGS[name] ?? deviceSlug(name);
      if (await db.deviceModel.findUnique({ where: { brandId_slug: { brandId: brand.id, slug: modelSlug } } })) continue;
      await db.deviceModel.create({
        data: { brandId: brand.id, categoryId: category.id, slug: modelSlug, name, releaseYear: RELEASE_YEAR[name] ?? null, popular: POPULAR.has(name), frame: FRAME.get(name) ?? null, aliases: phoneAliases(brandName, name) },
      });
      added++;
    }
  }
  console.log(`Phone models: ${added} added.`);
}

/**
 * "Not listed" choices: an "Other" brand in every category and an "Other model" under every brand, so customers
 * can still book, pick or customise an unlisted device (they type the real one). Create-only; safe on every deploy.
 */
async function addOtherOptions() {
  let added = 0;
  for (const category of await db.deviceCategory.findMany({ select: { id: true } })) {
    await db.deviceBrand.upsert({
      where: { categoryId_slug: { categoryId: category.id, slug: "other" } },
      create: { categoryId: category.id, slug: "other", name: OTHER_BRAND_NAME, sortOrder: 999 },
      update: {},
    });
    for (const brand of await db.deviceBrand.findMany({ where: { categoryId: category.id }, select: { id: true } })) {
      const exists = await db.deviceModel.findUnique({ where: { brandId_slug: { brandId: brand.id, slug: "other-model" } }, select: { id: true } });
      if (exists) continue;
      await db.deviceModel.create({ data: { brandId: brand.id, categoryId: category.id, slug: "other-model", name: OTHER_MODEL_NAME, releaseYear: null } });
      added++;
    }
  }
  console.log(`Other options: ${added} added.`);
}

async function seedCatalog() {
  let order = 0;
  for (const [catSlug, cat] of Object.entries(CATALOG)) {
    const category = await db.deviceCategory.upsert({
      where: { slug: catSlug },
      create: { slug: catSlug, nameEn: cat.nameEn, nameHi: cat.nameHi, sortOrder: order++ },
      update: { nameEn: cat.nameEn, nameHi: cat.nameHi },
    });
    let bOrder = 0;
    for (const [brandName, models] of Object.entries(cat.brands)) {
      const brand = await db.deviceBrand.upsert({
        where: { categoryId_slug: { categoryId: category.id, slug: slug(brandName) } },
        create: { categoryId: category.id, slug: slug(brandName), name: brandName, sortOrder: bOrder++ },
        update: { name: brandName },
      });
      for (const m of models) {
        const modelSlug = LEGACY_MODEL_SLUGS[m] ?? deviceSlug(m);
        const meta = {
          name: m,
          releaseYear: RELEASE_YEAR[m] ?? null,
          popular: POPULAR.has(m),
          frame: FRAME.get(m) ?? null,
          aliases: catSlug === "phone" ? phoneAliases(brandName, m) : [],
        };
        await db.deviceModel.upsert({
          where: { brandId_slug: { brandId: brand.id, slug: modelSlug } },
          create: { brandId: brand.id, categoryId: category.id, slug: modelSlug, ...meta },
          update: meta,
        });
      }
    }
    let iOrder = 0;
    for (const [en, hi] of cat.issues) {
      await db.repairIssueType.upsert({
        where: { categoryId_slug: { categoryId: category.id, slug: slug(en) } },
        create: { categoryId: category.id, slug: slug(en), nameEn: en, nameHi: hi, sortOrder: iOrder++ },
        update: { nameEn: en, nameHi: hi },
      });
    }
  }

  // Sample diagnosis-fee rules (illustrative values — confirm with the Owner).
  const laptop = await db.deviceCategory.findUniqueOrThrow({ where: { slug: "laptop" } });
  const water = await db.repairIssueType.findFirstOrThrow({ where: { slug: "water-or-liquid-damage" } });
  if ((await db.diagnosisFeeRule.count()) === 0) {
    await db.diagnosisFeeRule.createMany({
      data: [
        { categoryId: laptop.id, feePaise: 29900, waivedIfApproved: true },
        { issueTypeId: water.id, feePaise: 49900, waivedIfApproved: false },
      ],
    });
  }

  if ((await db.priceItem.count()) === 0) {
    const screen = await db.repairIssueType.findFirstOrThrow({ where: { slug: "broken-or-cracked-screen", category: { slug: "phone" } } });
    const battery = await db.repairIssueType.findFirstOrThrow({ where: { slug: "battery-drains-fast-not-charging" } });
    await db.priceItem.createMany({
      data: [
        { kind: "LABOUR", name: "Standard repair labour", unitPaise: 49900 },
        { kind: "LABOUR", name: "Advanced board-level labour", unitPaise: 149900 },
        { kind: "PART", name: "Display assembly (compatible)", unitPaise: 349900, partGrade: "compatible", issueTypeId: screen.id },
        { kind: "PART", name: "Display assembly (original)", unitPaise: 899900, partGrade: "original", issueTypeId: screen.id },
        { kind: "PART", name: "Battery (compatible)", unitPaise: 179900, partGrade: "compatible", issueTypeId: battery.id },
        { kind: "OTHER", name: "Ultrasonic cleaning", unitPaise: 59900 },
        { kind: "DISCOUNT", name: "Loyalty discount", unitPaise: 10000 },
      ],
    });
  }

  if ((await db.warrantyPolicy.count()) === 0) {
    await db.warrantyPolicy.create({
      data: {
        name: "Standard repair warranty",
        days: 90,
        termsEn: "90-day warranty on the replaced part and workmanship. Excludes physical damage, liquid damage and software issues after return. (Placeholder terms — D-16.)",
        termsHi: "बदले गए पार्ट और कारीगरी पर 90 दिन की वारंटी। वापसी के बाद शारीरिक क्षति, तरल क्षति और सॉफ़्टवेयर समस्याएँ शामिल नहीं हैं।",
      },
    });
  }
}

async function seedAreasAndSlots() {
  for (const [pincode, locality] of JAIPUR_AREAS) {
    await db.serviceableArea.upsert({ where: { pincode }, create: { pincode, locality }, update: {} });
  }
  // Next 21 days, Mon–Sat, three windows, capacity 4.
  const windows = [
    ["10:00", "12:00"],
    ["13:00", "15:00"],
    ["16:00", "19:00"],
  ];
  const today = new Date(new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10));
  for (let d = 0; d < 21; d++) {
    const date = new Date(today.getTime() + d * 86_400_000);
    if (date.getUTCDay() === 0) continue;
    for (const [startTime, endTime] of windows) {
      await db.appointmentSlot.upsert({ where: { date_startTime: { date, startTime } }, create: { date, startTime, endTime, capacity: 4 }, update: {} });
    }
  }
}

/** Supabase Auth admin client for demo logins; null when SUPABASE_SECRET_KEY is not set (app data is still seeded). */
const supabase: SupabaseClient | null =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

/** Create (or reset the password of) the Supabase login for a demo account and return its id. */
async function upsertAuthLogin(email: string, name: string, password: string): Promise<string | null> {
  if (!supabase) return null;
  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (created.data.user) return created.data.user.id;
  // Already exists: find it and reset the password so the printed demo password works.
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) {
      await supabase.auth.admin.updateUserById(found.id, { password, email_confirm: true });
      return found.id;
    }
    if (data.users.length < 200) break;
  }
  throw new Error(`Could not create Supabase login for ${email}: ${created.error?.message}`);
}

async function upsertPasswordUser(email: string, name: string, password: string, roles: string[]) {
  const authUserId = await upsertAuthLogin(email, name, password);
  const user = await db.user.upsert({
    where: { email },
    create: { email, name, emailVerified: true, authUserId },
    update: { name, ...(authUserId ? { authUserId } : {}) },
  });
  await db.customerProfile.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });

  if (roles.length) {
    await db.staffProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, displayName: name }, update: { active: true } });
    const roleRows = await db.role.findMany({ where: { key: { in: roles } } });
    for (const r of roleRows) await db.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: r.id } }, create: { userId: user.id, roleId: r.id }, update: {} });
  }
  return user;
}

async function seedDemoUsers() {
  const password = process.env.SEED_DEMO_PASSWORD ?? "Technentium#2026";
  if (isProd && !process.env.SEED_DEMO_PASSWORD) throw new Error("SEED_TEST_USERS needs SEED_DEMO_PASSWORD in production.");
  // Local backend testing: sign in as "admin" / "admin123" (the username alias only works outside production).
  await upsertPasswordUser("admin@technentium.test", "Admin (demo)", isProd ? password : "admin123", ["owner"]);
  await upsertPasswordUser("owner@technentium.test", "Owner (demo)", password, ["owner"]);
  await upsertPasswordUser("staff@technentium.test", "Priya (staff)", password, ["staff"]);
  await upsertPasswordUser("tech@technentium.test", "Ravi (technician)", password, ["technician"]);
  await upsertPasswordUser("tech2@technentium.test", "Imran (technician)", password, ["technician"]);
  await upsertPasswordUser("customer@technentium.test", "Asha (customer)", password, []);
  await upsertPasswordUser("editor@technentium.test", "Meera (editor)", password, ["editor"]);
  await upsertPasswordUser("inventory@technentium.test", "Arjun (inventory)", password, ["inventory"]);
  if (!isProd) console.log("Test admin: admin / admin123 (admin@technentium.test)");
  console.log(`Demo users (password: ${password}): admin@ (prod only), owner@, staff@, tech@, tech2@, editor@, inventory@, customer@technentium.test`);
  if (!supabase) console.warn("SUPABASE_SECRET_KEY not set: demo accounts have no Supabase login yet (re-run the seed once it is set).");
}

/**
 * Make OWNER_EMAIL the Owner. No password is created: the person signs up (or signs in with Google) with that
 * email, and the first sign-in with it confirmed links to this account.
 */
async function bootstrapOwner() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email) return;
  const owner = await db.role.findUniqueOrThrow({ where: { key: "owner" } });
  const user = await db.user.upsert({ where: { email }, create: { email, name: "Owner", customerProfile: { create: {} } }, update: {} });
  await db.staffProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, displayName: user.name }, update: { active: true, deactivatedAt: null } });
  await db.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: owner.id } }, create: { userId: user.id, roleId: owner.id }, update: {} });
  console.log(`Owner: ${email}`);
}

/** First deploy only: offer Google / mobile OTP only if those providers are enabled in Supabase. */
async function defaultSignInSwitches() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }).catch(() => null);
  const settings = (await res?.json().catch(() => null)) as { external?: { google?: boolean; phone?: boolean } } | null;
  if (!settings?.external) return;
  for (const [key, value] of [
    ["features.signIn.google", false], // customers sign in with mobile OTP only; the owner can turn Google on in Feature controls
    ["features.signIn.phoneOtp", !!settings.external.phone],
  ] as const) {
    await db.businessSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
}

async function main() {
  await seedRbac();
  if (isDeploy) {
    const fresh = (await db.deviceCategory.count()) === 0;
    await bootstrapOwner();
    await defaultSignInSwitches();
    // Pre-launch testing: SEED_TEST_USERS=true also creates the demo accounts (one per role) on this deploy.
    if (process.env.SEED_TEST_USERS === "true") await seedDemoUsers();
    if (!fresh) {
      // New catalogue items and articles added in code reach production; existing rows are never touched.
      await addNewPhoneModels();
      await addOtherOptions();
      await seedShop(db, { onlyNew: true });
      await seedProductImages(db);
      await seedContent(db, { onlyNew: true });
      await seedContentImages(db);
      return console.log("Deploy seed: roles and owner updated, new products and articles added.");
    }
  }
  await seedCatalog();
  await addOtherOptions();
  await seedRepairEstimates(db);
  await seedAreasAndSlots();
  if (!isProd) await seedDemoUsers();
  // Section catalogues (products, designs, articles/specs) — sample data, replaced by real content before launch.
  await seedShop(db);
  await seedProductImages(db);
  await seedCustomization(db);
  await seedContent(db);
  await seedContentImages(db);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
