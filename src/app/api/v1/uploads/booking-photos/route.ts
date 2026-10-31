import { api } from "@/server/http";
import { AppError } from "@/server/errors";
import { MAX_UPLOAD_BYTES } from "@/server/storage/images";
import { uploadBookingPhoto } from "@/server/modules/repairs/attachment.service";

/** POST /api/v1/uploads/booking-photos — multipart field `file`; returns the attachment id. */
export const POST = api(async (req, _ctx, actor) => {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError("VALIDATION", "errors.upload.tooLarge");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "errors.upload.empty");
  return uploadBookingPhoto(actor, Buffer.from(await file.arrayBuffer()));
});
