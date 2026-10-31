import { z } from "zod";
import { api } from "@/server/http";
import { AppError } from "@/server/errors";
import { MAX_UPLOAD_BYTES } from "@/server/storage/images";
import { parse } from "@/server/validation";
import { uploadMedia } from "@/server/modules/media/media.service";

const fieldsSchema = z.object({
  purpose: z.enum(["PRODUCT_IMAGE", "DESIGN_IMAGE", "CONTENT_IMAGE", "DEVICE_IMAGE", "CUSTOM_ARTWORK"]),
  draftKey: z.string().max(64).optional(),
  altEn: z.string().max(200).optional(),
  altHi: z.string().max(200).optional(),
});

/**
 * POST /api/v1/media — multipart: `file`, `purpose`, optional `draftKey`, `altEn`, `altHi`.
 * Returns `{ id, width, height, purpose, isPublic }`; display via `/api/v1/media/{id}`.
 */
export const POST = api(async (req, _ctx, actor) => {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError("VALIDATION", "errors.upload.tooLarge");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "errors.upload.empty");
  const fields = parse(fieldsSchema, {
    purpose: form.get("purpose") ?? undefined,
    draftKey: form.get("draftKey") ?? undefined,
    altEn: form.get("altEn") ?? undefined,
    altHi: form.get("altHi") ?? undefined,
  });
  return uploadMedia(actor, Buffer.from(await file.arrayBuffer()), fields);
});
