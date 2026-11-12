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

/** Remove an unattached draft upload (customer artwork before submit) or a public asset (staff). */
export async function removeMedia(actor: Actor | null, id: string) {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
  const media = await db.mediaAsset.findUnique({ where: { id }, include: { _count: { select: { productImages: true } } } });
  if (!media) throw notFound("media");
  const ownDraft = !media.isPublic && media.uploadedById === actor.userId && !media.customizationRequestId;
  const staffPublic = media.isPublic && can(actor, "media.upload") && media._count.productImages === 0;
  if (!ownDraft && !staffPublic) throw notFound("media");
  await db.mediaAsset.delete({ where: { id } });
  await storage().remove(media.storageKey);
}
