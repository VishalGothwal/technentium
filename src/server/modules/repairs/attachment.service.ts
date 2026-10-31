import "server-only";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { enforce } from "@/server/rate-limit";
import { assertCan, can, type Actor } from "@/server/rbac/actor";
import { processImageUpload } from "@/server/storage/images";
import { storage } from "@/server/storage/storage";
import { assertJobAccess } from "./transition";

/** Customer photo for a booking that is about to be submitted. Linked to the booking on submit. */
export async function uploadBookingPhoto(actor: Actor | null, file: Buffer) {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
  await enforce(`upload:${actor.userId}`, 3600, 40);
  const img = await processImageUpload(file, `bookings/${actor.userId}`);
  await storage().put(img.key, img.body, img.mime);
  const row = await db.repairAttachment.create({
    data: { storageKey: img.key, mime: img.mime, sizeBytes: img.sizeBytes, width: img.width, height: img.height, purpose: "BOOKING_PHOTO", uploadedById: actor.userId, draftKey: "pending" },
    select: { id: true },
  });
  return row;
}

/** Receipt / inspection evidence uploaded by staff or the assigned technician (FR-REPAIR-03). */
export async function uploadJobPhoto(actor: Actor | null, jobId: string, purpose: "RECEIPT_PHOTO" | "INSPECTION_PHOTO", file: Buffer) {
  assertCan(actor, "job.inspect", "job.diagnose");
  await assertJobAccess(db, actor, jobId);
  await enforce(`upload:${actor.userId}`, 3600, 200);
  const img = await processImageUpload(file, `jobs/${jobId}`);
  await storage().put(img.key, img.body, img.mime);
  const row = await db.repairAttachment.create({
    data: { storageKey: img.key, mime: img.mime, sizeBytes: img.sizeBytes, width: img.width, height: img.height, purpose, uploadedById: actor.userId, jobId },
  });
  await db.$transaction((tx) => audit(tx, actor, { action: "job.photo", entityType: "RepairJob", entityId: jobId, after: { attachmentId: row.id, purpose } }));
  return { id: row.id };
}

/**
 * Authorise a download. Owners see photos on their own bookings; staff need booking/job access.
 * Unauthorised requests get NOT_FOUND so ids cannot be probed (§13.2, IDOR).
 */
export async function authorizeAttachment(actor: Actor | null, attachmentId: string) {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
  const att = await db.repairAttachment.findUnique({
    where: { id: attachmentId },
    include: { booking: { select: { customerId: true, job: { select: { id: true } } } }, job: { select: { id: true, booking: { select: { customerId: true } } } } },
  });
  if (!att) throw notFound("attachment");

  const customerId = att.booking?.customerId ?? att.job?.booking.customerId ?? null;
  const jobId = att.job?.id ?? att.booking?.job?.id ?? null;

  const isOwnerCustomer = customerId === actor.userId && att.purpose === "BOOKING_PHOTO";
  const isUploaderDraft = !att.bookingId && !att.jobId && att.uploadedById === actor.userId;
  let isStaffAllowed = false;
  if (actor.isStaff) {
    if (can(actor, "booking.view_all") || can(actor, "job.view_all")) isStaffAllowed = true;
    else if (jobId) {
      try {
        await assertJobAccess(db, actor, jobId);
        isStaffAllowed = true;
      } catch {
        isStaffAllowed = false;
      }
    }
  }
  if (!isOwnerCustomer && !isUploaderDraft && !isStaffAllowed) throw notFound("attachment");
  return att;
}

export async function removeDraftPhoto(actor: Actor | null, attachmentId: string) {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
  const att = await db.repairAttachment.findFirst({ where: { id: attachmentId, uploadedById: actor.userId, bookingId: null, jobId: null } });
  if (!att) throw notFound("attachment");
  await db.repairAttachment.delete({ where: { id: att.id } });
  await storage().remove(att.storageKey);
}
