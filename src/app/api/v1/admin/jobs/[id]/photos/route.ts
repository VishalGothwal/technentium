import { api } from "@/server/http";
import { AppError } from "@/server/errors";
import { MAX_UPLOAD_BYTES } from "@/server/storage/images";
import { uploadJobPhoto } from "@/server/modules/repairs/attachment.service";

/**
 * POST /api/v1/admin/jobs/{id}/photos — receipt/inspection evidence (FR-REPAIR-03).
 * Multipart: `file`, `purpose` = RECEIPT_PHOTO | INSPECTION_PHOTO. Permission and job access are checked by the service.
 */
export const POST = api<RouteContext<"/api/v1/admin/jobs/[id]/photos">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError("VALIDATION", "errors.upload.tooLarge");
  const form = await req.formData();
  const file = form.get("file");
  const purpose = form.get("purpose") === "RECEIPT_PHOTO" ? "RECEIPT_PHOTO" : "INSPECTION_PHOTO";
  if (!(file instanceof File)) throw new AppError("VALIDATION", "errors.upload.empty");
  return uploadJobPhoto(actor, id, purpose, Buffer.from(await file.arrayBuffer()));
});
