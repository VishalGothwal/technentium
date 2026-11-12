import "server-only";
import { MODEL3D_SELECT } from "@/lib/device-3d";
import { db } from "@/server/db";
import { getSetting } from "@/server/settings";
import { resolveDiagnosisFee } from "@/server/modules/pricing/diagnosis-fee";

/** Public catalogue reads used by the booking wizard (guest-accessible). */

export const listCategories = () =>
  db.deviceCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }], select: { id: true, slug: true, nameEn: true, nameHi: true } });

const activeModels = { active: true } as const;

/** Brands of a category (by id or slug) that have at least one active model, with their model counts. */
export const listBrands = (category: { id?: string | null; slug?: string | null }) =>
  db.deviceBrand.findMany({
    where: { active: true, models: { some: activeModels }, category: category.id ? { id: category.id } : { slug: category.slug ?? "" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, _count: { select: { models: { where: activeModels } } } },
  });

/** Models of a brand: popular first, then newest. */
export const listModels = (brandId: string) =>
  db.deviceModel.findMany({
    where: { brandId, active: true },
    orderBy: [{ popular: "desc" }, { releaseYear: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    select: { id: true, slug: true, name: true, releaseYear: true, popular: true, frame: true },
  });

export const listIssues = (categoryId: string) =>
  db.repairIssueType.findMany({
    where: { categoryId, active: true },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    select: { id: true, slug: true, nameEn: true, nameHi: true, descriptionEn: true, descriptionHi: true },
  });

export async function checkServiceability(pincode: string) {
  const area = await db.serviceableArea.findUnique({ where: { pincode } });
  return area?.active ? { serviceable: true as const, locality: area.locality, city: area.city } : { serviceable: false as const };
}

/**
 * Upcoming slots with remaining capacity. Remaining counts submitted and confirmed bookings so customers
 * are not offered slots that are already spoken for; capacity is enforced at staff confirmation.
 */
export async function listAvailableSlots(days = 7) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const until = new Date(today.getTime() + days * 86_400_000);
  const slots = await db.appointmentSlot.findMany({
    where: { active: true, date: { gte: today, lt: until } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      capacity: true,
      _count: { select: { bookings: { where: { status: { in: ["SUBMITTED", "NEEDS_INFO", "CONFIRMED"] } } } } },
    },
  });
  const nowIst = istNow();
  return slots
    .filter((s) => slotStartIst(s.date, s.startTime) > nowIst)
    .map((s) => ({
      id: s.id,
      date: s.date.toISOString().slice(0, 10),
      startTime: s.startTime,
      endTime: s.endTime,
      remaining: Math.max(0, s.capacity - s._count.bookings),
    }));
}

/** Minutes since epoch in IST "wall clock", for comparing slot times (Asia/Kolkata has no DST). */
const IST_OFFSET_MS = 330 * 60_000;
const istNow = () => Date.now() + IST_OFFSET_MS;
export const slotStartIst = (date: Date, startTime: string) => {
  const [h, m] = startTime.split(":").map(Number);
  return date.getTime() + (h * 60 + m) * 60_000;
};

export async function previewDiagnosisFee(modelId: string, issueTypeIds: string[]) {
  const model = await db.deviceModel.findUnique({ where: { id: modelId }, select: { id: true, categoryId: true } });
  if (!model) return null;
  const [rules, defaultFee] = await Promise.all([
    db.diagnosisFeeRule.findMany({ where: { active: true } }),
    getSetting("booking.defaultDiagnosisFeePaise"),
  ]);
  return resolveDiagnosisFee(rules, { categoryId: model.categoryId, modelId: model.id, issueTypeIds }, defaultFee);
}

const DEVICE_SELECT = {
  id: true,
  slug: true,
  name: true,
  releaseYear: true,
  popular: true,
  frame: true,
  imageMediaId: true,
  /** 3D body for previews (see src/lib/device-3d.ts `resolveDevice3d`). */
  model3d: MODEL3D_SELECT,
  brand: { select: { id: true, slug: true, name: true } },
  category: { select: { id: true, slug: true, nameEn: true, nameHi: true } },
} as const;

export type DeviceSearch = {
  q?: string | null;
  categoryId?: string | null;
  /** Category slug, e.g. "phone" (alternative to `categoryId`). */
  category?: string | null;
  /** Brand slug, e.g. "samsung". */
  brand?: string | null;
  year?: number | null;
  limit?: number;
  offset?: number;
};

/**
 * Search every active device model across categories and brands (shared device selector for repairs,
 * protection compatibility, customization and specifications). Each query word must match the model name,
 * the brand or a search shorthand ("s24u"). With no query and no brand/year filter, returns popular models.
 */
export function searchDevices({ q, categoryId, category, brand, year, limit = 24, offset = 0 }: DeviceSearch) {
  const terms = (q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const narrowed = terms.length > 0 || !!brand || !!year;
  const insensitive = "insensitive" as const;
  return db.deviceModel.findMany({
    where: {
      active: true,
      brand: { active: true, ...(brand ? { slug: brand } : {}) },
      category: { active: true, ...(category ? { slug: category } : {}) },
      ...(categoryId ? { categoryId } : {}),
      ...(year ? { releaseYear: year } : {}),
      ...(terms.length
        ? {
            AND: terms.map((t) => ({
              OR: [{ name: { contains: t, mode: insensitive } }, { brand: { name: { contains: t, mode: insensitive } } }, { aliases: { has: t.toLowerCase() } }],
            })),
          }
        : {}),
      ...(narrowed ? {} : { popular: true }),
    },
    orderBy: [{ popular: "desc" }, { releaseYear: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    take: Math.min(Math.max(limit, 1), 100),
    skip: Math.min(Math.max(offset, 0), 5000),
    select: DEVICE_SELECT,
  });
}

export const getDeviceModel = (id: string) => db.deviceModel.findFirst({ where: { id, active: true }, select: DEVICE_SELECT });
