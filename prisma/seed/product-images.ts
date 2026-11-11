import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * Product photos shipped in the repo (prisma/seed/product-images/<product slug>.webp; sources and credits in
 * docs/product-image-sources.csv). Each one is uploaded to storage and attached to its product, but only
 * when that product has no photo yet, so photos the owner uploads in Admin → Products are never replaced.
 */
const DIR = path.join(process.cwd(), "prisma", "seed", "product-images");

async function put(key: string, body: Buffer) {
  if (process.env.STORAGE_DRIVER === "s3") {
    const { S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, S3_REGION } = process.env;
    if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) throw new Error("S3 storage is not configured");
    const client = new S3Client({ region: S3_REGION || "auto", endpoint: S3_ENDPOINT || undefined, forcePathStyle: !!S3_ENDPOINT, credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY } });
    await client.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: "image/webp" }));
    return;
  }
  if (supabaseStorage()) {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
    if ((await client.storage.getBucket("media")).error) await client.storage.createBucket("media", { public: false, fileSizeLimit: "30MB" });
    const { error } = await client.storage.from("media").upload(key, body, { contentType: "image/webp", upsert: true });
    if (error) throw new Error(`Supabase storage: ${error.message}`);
    return;
  }
  const file = path.join(process.cwd(), ".uploads", key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

/** Same rule as src/server/storage/storage.ts. */
const supabaseStorage = () =>
  process.env.STORAGE_DRIVER === "supabase" || ((process.env.NODE_ENV === "production" || process.env.SEED_MODE === "deploy") && !!process.env.SUPABASE_SECRET_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function seedProductImages(db: PrismaClient) {
  if (!existsSync(DIR)) return;
  if ((process.env.NODE_ENV === "production" || process.env.SEED_MODE === "deploy") && process.env.STORAGE_DRIVER !== "s3" && !supabaseStorage()) return console.log("Product photos skipped: no storage configured.");
  let added = 0;
  for (const file of (await readdir(DIR)).filter((f) => f.endsWith(".webp"))) {
    const product = await db.product.findUnique({ where: { slug: file.slice(0, -5) }, select: { id: true, nameEn: true, _count: { select: { images: true } } } });
    if (!product || product._count.images > 0) continue;
    const body = await readFile(path.join(DIR, file));
    const meta = await sharp(body).metadata();
    const key = `media/product_image/${randomUUID()}.webp`;
    try {
      await put(key, body);
    } catch (e) {
      console.warn(`Product photos stopped: ${(e as Error).message}`);
      break;
    }
    const media = await db.mediaAsset.create({
      data: { storageKey: key, mime: "image/webp", sizeBytes: body.byteLength, width: meta.width ?? null, height: meta.height ?? null, purpose: "PRODUCT_IMAGE", isPublic: true, altEn: product.nameEn, uploadedById: "seed" },
    });
    await db.productImage.create({ data: { productId: product.id, mediaId: media.id, sortOrder: 0 } });
    added++;
  }
  console.log(`Product photos: ${added} attached.`);
}

/** Store one repo image as a public media asset; null when storage is unavailable. */
async function storeImage(db: PrismaClient, file: string, purpose: "DEVICE_IMAGE" | "CONTENT_IMAGE", alt: string) {
  const body = await readFile(file);
  const meta = await sharp(body).metadata();
  const key = `media/${purpose.toLowerCase()}/${randomUUID()}.webp`;
  try {
    await put(key, body);
  } catch (e) {
    console.warn(`Seed images stopped: ${(e as Error).message}`);
    return null;
  }
  return db.mediaAsset.create({
    data: { storageKey: key, mime: "image/webp", sizeBytes: body.byteLength, width: meta.width ?? null, height: meta.height ?? null, purpose, isPublic: true, altEn: alt, uploadedById: "seed" },
  });
}

const storageReady = () => !((process.env.NODE_ENV === "production" || process.env.SEED_MODE === "deploy") && process.env.STORAGE_DRIVER !== "s3" && !supabaseStorage());

/**
 * Phone photos (prisma/seed/spec-images/<spec slug>.webp) and article covers (prisma/seed/article-covers/<slug>.webp),
 * attached only where none is set yet, so editors' own images are never replaced. Sources: docs/*-image-sources.csv.
 */
export async function seedContentImages(db: PrismaClient) {
  if (!storageReady()) return console.log("Content images skipped: no storage configured.");
  let specs = 0;
  let covers = 0;
  const specDir = path.join(process.cwd(), "prisma", "seed", "spec-images");
  if (existsSync(specDir))
    for (const f of (await readdir(specDir)).filter((x) => x.endsWith(".webp"))) {
      const spec = await db.deviceSpecification.findUnique({ where: { slug: f.slice(0, -5) }, select: { id: true, imageMediaId: true, deviceModel: { select: { name: true } } } });
      if (!spec || spec.imageMediaId) continue;
      const media = await storeImage(db, path.join(specDir, f), "DEVICE_IMAGE", spec.deviceModel.name);
      if (!media) break;
      await db.deviceSpecification.update({ where: { id: spec.id }, data: { imageMediaId: media.id } });
      specs++;
    }
  const coverDir = path.join(process.cwd(), "prisma", "seed", "article-covers");
  if (existsSync(coverDir))
    for (const f of (await readdir(coverDir)).filter((x) => x.endsWith(".webp"))) {
      const item = await db.contentItem.findFirst({ where: { slug: f.slice(0, -5) }, select: { id: true, coverMediaId: true, slug: true } });
      if (!item || item.coverMediaId) continue;
      const media = await storeImage(db, path.join(coverDir, f), "CONTENT_IMAGE", item.slug.replace(/-/g, " "));
      if (!media) break;
      await db.contentItem.update({ where: { id: item.id }, data: { coverMediaId: media.id } });
      covers++;
    }
  console.log(`Content images: ${specs} phone photos, ${covers} article covers attached.`);
}
