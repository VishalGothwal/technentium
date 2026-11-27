import "server-only";
import type { MediaPurpose } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { enforce } from "@/server/rate-limit";
import { assertCan, can, type Actor } from "@/server/rbac/actor";
import { processImageUpload } from "@/server/storage/images";
import { storage } from "@/server/storage/storage";

/** Staff-managed public images; customer artwork is the only private purpose. */
const PUBLIC_PURPOSES: readonly MediaPurpose[] = ["PRODUCT_IMAGE", "DESIGN_IMAGE", "CONTENT_IMAGE", "DEVICE_IMAGE"];

export type UploadMediaInput = { purpose: MediaPurpose; draftKey?: string | null; altEn?: string | null; altHi?: string | null };

/**
 * Upload an image outside the repair flow. Public purposes need `media.upload`; custom artwork can be
 * uploaded by any signed-in customer and stays private until linked to their customization request.
 */
export async function uploadMedia(actor: Actor | null, file: Buffer, input: UploadMediaInput) {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
  const isPublic = PUBLIC_PURPOSES.includes(input.purpose);
  if (isPublic) assertCan(actor, "media.upload");
  await enforce(`media:${actor.userId}`, 3600, isPublic ? 300 : 30);

  const img = await processImageUpload(file, isPublic ? `media/${input.purpose.toLowerCase()}` : `artwork/${actor.userId}`);
  await storage().put(img.key, img.body, img.mime);
  return db.mediaAsset.create({
    data: {
      storageKey: img.key,
      mime: img.mime,
      sizeBytes: img.sizeBytes,
      width: img.width,
      height: img.height,
      purpose: input.purpose,
      isPublic,
      altEn: input.altEn?.slice(0, 200) || null,
      altHi: input.altHi?.slice(0, 200) || null,
      uploadedById: actor.userId,
      draftKey: isPublic ? null : (input.draftKey?.slice(0, 64) ?? "pending"),
    },
    select: { id: true, width: true, height: true, purpose: true, isPublic: true },
  });
}

/**
 * Resolve a media asset for download. Public assets are open to everyone. Private artwork is
 * visible to its uploader and to staff who handle customization; everyone else gets NOT_FOUND (IDOR).
 */
export async function authorizeMedia(actor: Actor | null, id: string) {
  const media = await db.mediaAsset.findUnique({
    where: { id },
    select: { storageKey: true, mime: true, isPublic: true, sizeBytes: true, uploadedById: true, customizationRequest: { select: { customerId: true } } },
  });
  if (!media) throw notFound("media");
  if (media.isPublic) return media;
  if (!actor) throw notFound("media");
  const isOwner = media.uploadedById === actor.userId || media.customizationRequest?.customerId === actor.userId;
  const isStaff = actor.isStaff && (can(actor, "customization.manage") || can(actor, "customization.technical_input"));
  if (!isOwner && !isStaff) throw notFound("media");
  return media;
}

/**
 * Daily cron: delete customer uploads never attached to a booking or design request (the wizard or studio was
 * abandoned). 30 days, because studio drafts are kept in the browser and can be resumed later. The stored file
 * goes first; if that fails the row stays and the next run retries.
 */
export async function purgeAbandonedUploads(now = new Date(), limit = 200) {
  const before = new Date(now.getTime() - 30 * 86_400_000);
  const [photos, artwork] = await Promise.all([
    db.repairAttachment.findMany({ where: { purpose: "BOOKING_PHOTO", bookingId: null, jobId: null, createdAt: { lt: before } }, select: { id: true, storageKey: true }, take: limit }),
    db.mediaAsset.findMany({ where: { purpose: "CUSTOM_ARTWORK", isPublic: false, customizationRequestId: null, createdAt: { lt: before } }, select: { id: true, storageKey: true }, take: limit }),
  ]);
  const purge = async (rows: { id: string; storageKey: string }[], removeRow: (id: string) => Promise<unknown>) => {
    let n = 0;
    for (const row of rows) {
      try {
        await storage().remove(row.storageKey);
        await removeRow(row.id);
        n++;
      } catch (e) {
        console.warn(`[uploads] purge ${row.id} failed: ${(e as Error).message}`);
      }
    }
    return n;
  };
  return (
    (await purge(photos, (id) => db.repairAttachment.delete({ where: { id } }))) +
    (await purge(artwork, (id) => db.mediaAsset.delete({ where: { id } })))
  );
}

/** These references are plain id columns (no foreign key), so the database would let a used image be deleted. */
async function publicMediaInUse(id: string) {
  const counts = await Promise.all([
    db.deviceModel.count({ where: { imageMediaId: id } }),
    db.deviceSpecification.count({ where: { imageMediaId: id } }),
    db.productType.count({ where: { imageMediaId: id } }),
    db.design.count({ where: { previewMediaId: id } }),
    db.contentItem.count({ where: { coverMediaId: id } }),
    db.device3DModel.count({ where: { fileId: id } }),
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM content_translations WHERE body::text LIKE ${`%"${id}"%`}`.then((r) => r[0].n),
  ]);
  return counts.some((n) => n > 0);
}

/** Remove an unattached draft upload (customer artwork before submit) or a public asset (staff). */
export async function removeMedia(actor: Actor | null, id: string) {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
  const media = await db.mediaAsset.findUnique({ where: { id }, include: { _count: { select: { productImages: true } } } });
  if (!media) throw notFound("media");
  const ownDraft = !media.isPublic && media.uploadedById === actor.userId && !media.customizationRequestId;
  const staffPublic = media.isPublic && can(actor, "media.upload") && media._count.productImages === 0;
  if (!ownDraft && !staffPublic) throw notFound("media");
  if (staffPublic && (await publicMediaInUse(id))) throw new AppError("CONFLICT", "errors.conflict.inUse");
  await db.mediaAsset.delete({ where: { id } });
  await storage().remove(media.storageKey);
}
