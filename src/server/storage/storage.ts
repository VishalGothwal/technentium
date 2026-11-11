import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/server/env";
import { supabaseAdmin, supabaseAdminConfigured } from "@/server/supabase/admin";

/**
 * Private object storage (PRD §13.2). Objects are never public: access goes through an
 * authorising route that streams (local) or redirects to a short-lived signed URL (S3/R2).
 */
export interface StorageAdapter {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Signed URL for direct download, or null when the adapter must stream through the app. */
  signedUrl(key: string, ttlSeconds: number): Promise<string | null>;
  /** Signed URL the browser can PUT a file to directly (large uploads), or null when uploads must go through the app. */
  signedPutUrl(key: string, contentType: string, ttlSeconds: number): Promise<string | null>;
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
  async signedPutUrl() {
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
    async signedPutUrl(Key, ContentType, ttl) {
      return getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType }), { expiresIn: ttl });
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

/** Private Supabase Storage bucket used by the "supabase" driver (created on first use). */
export const SUPABASE_BUCKET = "media";
let supa: StorageAdapter | undefined;

function supabaseAdapter(): StorageAdapter {
  if (supa) return supa;
  let ready: Promise<void> | null = null;
  const bucket = async () => {
    ready ??= (async () => {
      const client = supabaseAdmin();
      const { error } = await client.storage.getBucket(SUPABASE_BUCKET);
      if (error) {
        const created = await client.storage.createBucket(SUPABASE_BUCKET, { public: false, fileSizeLimit: "30MB" });
        if (created.error && !/exists/i.test(created.error.message)) throw new Error(`Supabase storage: ${created.error.message}`);
      }
    })().catch((e) => {
      ready = null;
      throw e;
    });
    await ready;
    return supabaseAdmin().storage.from(SUPABASE_BUCKET);
  };
  const check = <T>(res: { data: T; error: null } | { data: null; error: { message: string } }): T => {
    if (res.error) throw new Error(`Supabase storage: ${res.error.message}`);
    return res.data as T;
  };
  supa = {
    async put(key, body, contentType) {
      check(await (await bucket()).upload(key, body, { contentType, upsert: true }));
    },
    async signedUrl(key, ttl) {
      return check(await (await bucket()).createSignedUrl(key, ttl))!.signedUrl;
    },
    async signedPutUrl(key) {
      return check(await (await bucket()).createSignedUploadUrl(key))!.signedUrl;
    },
    async read(key) {
      return Buffer.from(await check(await (await bucket()).download(key))!.arrayBuffer());
    },
    async remove(key) {
      check(await (await bucket()).remove([key]));
    },
  };
  return supa;
}

export function storage(): StorageAdapter {
  const e = env();
  if (e.STORAGE_DRIVER === "s3") return s3Adapter();
  // Supabase Storage: chosen explicitly, or automatically in production when no S3 bucket is configured.
  if (e.STORAGE_DRIVER === "supabase" || (e.NODE_ENV === "production" && supabaseAdminConfigured())) return supabaseAdapter();
  // Serverless disks are ephemeral: refuse uploads rather than lose them. Checked here (not in env()) so an
  // unconfigured bucket only affects uploads, not sign-in codes or emails.
  if (e.NODE_ENV === "production") throw new Error("STORAGE_DRIVER=local is not allowed in production; configure S3/R2 storage");
  return localAdapter;
}
