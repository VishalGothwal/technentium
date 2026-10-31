import "server-only";
import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { AppError } from "@/server/errors";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 2000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ProcessedImage = { key: string; body: Buffer; mime: "image/webp"; width: number; height: number; sizeBytes: number };

/**
 * Validate by content (magic bytes), not by extension or client-declared type, then re-encode.
 * Re-encoding strips EXIF (including GPS location) and neutralises polyglot files (§13.2).
 */
export async function processImageUpload(input: Buffer, prefix: string): Promise<ProcessedImage> {
  if (input.byteLength === 0) throw new AppError("VALIDATION", "errors.upload.empty");
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new AppError("VALIDATION", "errors.upload.tooLarge");

  const type = await fileTypeFromBuffer(input);
  if (!type || !ALLOWED.has(type.mime)) throw new AppError("VALIDATION", "errors.upload.type");

  let out: { data: Buffer; info: { width: number; height: number } };
  try {
    out = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate() // honour orientation before metadata is dropped
      .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new AppError("VALIDATION", "errors.upload.corrupt");
  }

  return {
    key: `${prefix}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.webp`,
    body: out.data,
    mime: "image/webp",
    width: out.info.width,
    height: out.info.height,
    sizeBytes: out.data.byteLength,
  };
}
