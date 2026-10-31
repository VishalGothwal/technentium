import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/server/env";

/**
 * Private object storage (PRD §13.2). Objects are never public: access goes through an
 * authorising route that streams (local) or redirects to a short-lived signed URL (S3/R2).
 */
export interface StorageAdapter {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Signed URL for direct download, or null when the adapter must stream through the app. */
  signedUrl(key: string, ttlSeconds: number): Promise<string | null>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

const safeLocalPath = (key: string) => {
  const p = path.resolve(LOCAL_ROOT, key);
  if (!p.startsWith(LOCAL_ROOT + path.sep)) throw new Error("invalid storage key");
  return p;
};

const localAdapter: StorageAdapter = {
  async put(key, body) {
    const p = safeLocalPath(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
  },
  async signedUrl() {
    return null;
  },
  async read(key) {
    return readFile(safeLocalPath(key));
  },
  async remove(key) {
    await rm(safeLocalPath(key), { force: true });
  },
};

let s3: StorageAdapter | undefined;

function s3Adapter(): StorageAdapter {
  if (s3) return s3;
  const e = env();
  if (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) throw new Error("S3 storage is not configured");
  const client = new S3Client({
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT || undefined,
    forcePathStyle: !!e.S3_ENDPOINT,
    credentials: { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY },
  });
  const Bucket = e.S3_BUCKET;
  s3 = {
    async put(Key, Body, ContentType) {
      await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }));
    },
    async signedUrl(Key, ttl) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key }), { expiresIn: ttl });
    },
    async read(Key) {
      const res = await client.send(new GetObjectCommand({ Bucket, Key }));
      return Buffer.from(await res.Body!.transformToByteArray());
    },
    async remove(Key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key }));
    },
  };
  return s3;
}

export function storage(): StorageAdapter {
  return env().STORAGE_DRIVER === "s3" ? s3Adapter() : localAdapter;
}
