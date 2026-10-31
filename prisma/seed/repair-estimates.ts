import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * Sample public repair estimates (illustrative rupee ranges — the Owner replaces these in Admin → Devices & pricing).
 * Only seeded into an empty table so admin edits are never overwritten.
 */

/** [category slug, issue slug, min ₹, max ₹] — issue-wide defaults. */
const DEFAULTS: [string, string, number, number][] = [
  ["phone", "broken-or-cracked-screen", 2499, 14999],
  ["phone", "battery-drains-fast-not-charging", 1299, 4999],
  ["phone", "charging-port-problem", 799, 2999],
  ["phone", "camera-not-working", 1499, 8999],
  ["phone", "speaker-or-microphone-problem", 699, 2499],
  ["phone", "water-or-liquid-damage", 999, 5999],
  ["phone", "back-glass-broken", 1499, 6999],
  ["phone", "software-not-turning-on", 499, 1999],
  ["tablet", "broken-or-cracked-screen", 4999, 24999],
  ["tablet", "battery-or-charging-problem", 2499, 7999],
  ["tablet", "software-not-turning-on", 699, 2499],
  ["laptop", "screen-damage", 5999, 29999],
  ["laptop", "keyboard-or-trackpad-problem", 1999, 9999],
  ["laptop", "battery-or-charging-problem", 2999, 11999],
  ["laptop", "slow-software-problem", 799, 2999],
  ["laptop", "liquid-damage", 2499, 14999],
  ["smartwatch", "broken-screen", 2999, 14999],
  ["smartwatch", "battery-or-charging-problem", 1499, 5999],
  ["smartwatch", "strap-or-button-problem", 499, 2499],
  ["smartwatch", "water-damage", 999, 4999],
  ["audio", "one-side-not-working", 999, 4999],
  ["audio", "charging-case-problem", 799, 3999],
  ["audio", "battery-drains-fast", 999, 3999],
];

/** [brand slug, model slug, issue slug, min ₹, max ₹] — flagship overrides where the default range is misleading. */
const OVERRIDES: [string, string, string, number, number][] = [
  ["apple", "iphone-16-pro-max", "broken-or-cracked-screen", 18999, 34999],
  ["apple", "iphone-16-pro", "broken-or-cracked-screen", 16999, 31999],
  ["apple", "iphone-15-pro-max", "broken-or-cracked-screen", 15999, 29999],
  ["apple", "iphone-15", "broken-or-cracked-screen", 8999, 19999],
  ["samsung", "galaxy-s24-ultra", "broken-or-cracked-screen", 14999, 26999],
  ["samsung", "galaxy-z-fold-6", "broken-or-cracked-screen", 24999, 49999],
];

export async function seedRepairEstimates(db: PrismaClient) {
  if ((await db.repairEstimate.count()) > 0) return;
  const issues = await db.repairIssueType.findMany({ select: { id: true, slug: true, category: { select: { slug: true } } } });
  const issueId = new Map(issues.map((i) => [`${i.category.slug}/${i.slug}`, i.id]));
  const data: { issueTypeId: string; modelId: string | null; minPaise: number; maxPaise: number }[] = [];
  for (const [cat, issue, min, max] of DEFAULTS) {
    const id = issueId.get(`${cat}/${issue}`);
    if (id) data.push({ issueTypeId: id, modelId: null, minPaise: min * 100, maxPaise: max * 100 });
  }
  for (const [brand, model, issue, min, max] of OVERRIDES) {
    const m = await db.deviceModel.findFirst({ where: { slug: model, brand: { slug: brand } }, select: { id: true } });
    const id = issueId.get(`phone/${issue}`);
    if (m && id) data.push({ issueTypeId: id, modelId: m.id, minPaise: min * 100, maxPaise: max * 100 });
  }
  await db.repairEstimate.createMany({ data });
}
