import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { enforce } from "@/server/rate-limit";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { storage } from "@/server/storage/storage";
import { parse } from "@/server/validation";
import { CUSTOMIZABLE_CATEGORIES, deviceKindFor } from "@/lib/customization/style";
import { device3dParamsSchema, MAX_GLB_BYTES, readParams } from "@/lib/device-3d";
import { DEFAULT_FRAME, isFrameKey } from "@/lib/device-frames";
import { DEVICE_DIMENSIONS } from "./device-dimensions";

/** Admin → 3D models: generated or uploaded (.glb) device bodies and which device models use them. `catalog.manage`. */

const slug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "studio.validation.slug").max(80);

export const device3dInputSchema = z.object({
  slug,
  name: z.string().trim().min(2, "validation.required").max(80),
  frame: z.string().refine(isFrameKey, "validation.invalid"),
  params: device3dParamsSchema.default({}),
  notes: z.string().trim().max(500).optional().default(""),
  active: z.boolean().default(true),
});

const idList = z.array(z.string().min(1).max(64)).max(500);

const taken = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

export async function listDevice3dModels(actor: Actor | null) {
  assertCan(actor, "catalog.manage");
  const [models, totals] = await Promise.all([
    db.device3DModel.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { devices: true } }, file: { select: { sizeBytes: true } } },
    }),
    db.deviceModel.groupBy({
      by: ["model3dId"],
      where: { active: true, category: { slug: { in: [...CUSTOMIZABLE_CATEGORIES] } } },
      _count: { _all: true },
    }),
  ]);
  const unassigned = totals.find((t) => t.model3dId === null)?._count._all ?? 0;
  const total = totals.reduce((n, t) => n + t._count._all, 0);
  return { models: models.map((m) => ({ ...m, params: readParams(m.params) })), coverage: { total, assigned: total - unassigned } };
}

export async function getDevice3dModel(actor: Actor | null, id: string) {
  assertCan(actor, "catalog.manage");
  const m = await db.device3DModel.findUnique({
    where: { id },
    include: {
      file: { select: { id: true, sizeBytes: true, createdAt: true } },
      devices: {
        orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
        select: { id: true, name: true, frame: true, brand: { select: { name: true } }, category: { select: { slug: true } } },
      },
    },
  });
  if (!m) throw notFound("record");
  return { ...m, params: readParams(m.params) };
}

/** Create (id = null) or update a 3D model. */
export async function saveDevice3dModel(actor: Actor | null, id: string | null, raw: unknown) {
  assertCan(actor, "catalog.manage");
  const input = parse(device3dInputSchema, raw);
  const data = { ...input, notes: input.notes || null, params: input.params as Prisma.InputJsonValue };
  try {
    return await db.$transaction(async (tx) => {
      const before = id ? await tx.device3DModel.findUnique({ where: { id } }) : null;
      if (id && !before) throw notFound("record");
      const row = id ? await tx.device3DModel.update({ where: { id }, data }) : await tx.device3DModel.create({ data });
      await audit(tx, actor, { action: id ? "device3d.update" : "device3d.create", entityType: "Device3DModel", entityId: row.id, before, after: data });
      return { id: row.id };
    });
  } catch (err) {
    if (taken(err)) throw new AppError("VALIDATION", "errors.validation", { fields: { slug: "studio.validation.slugTaken" } });
    throw err;
  }
}

/** Delete a model: its devices fall back to their generated body; the uploaded file is removed. */
export async function deleteDevice3dModel(actor: Actor | null, id: string) {
  assertCan(actor, "catalog.manage");
  const file = await db.$transaction(async (tx) => {
    const row = await tx.device3DModel.findUnique({ where: { id }, include: { file: true } });
    if (!row) throw notFound("record");
    await tx.deviceModel.updateMany({ where: { model3dId: id }, data: { model3dId: null } });
    await tx.device3DModel.delete({ where: { id } });
    if (row.file) await tx.mediaAsset.delete({ where: { id: row.file.id } });
    await audit(tx, actor, { action: "device3d.delete", entityType: "Device3DModel", entityId: id, before: { name: row.name, slug: row.slug } });
    return row.file;
  });
  if (file) await storage().remove(file.storageKey).catch(() => {});
}

/** Point device models at this 3D model (`add`) or back to their generated body (`remove`). */
export async function assignDevices(actor: Actor | null, id: string, raw: { add?: unknown; remove?: unknown }) {
  assertCan(actor, "catalog.manage");
  const add = parse(idList, raw.add ?? []);
  const remove = parse(idList, raw.remove ?? []);
  await db.$transaction(async (tx) => {
    const exists = await tx.device3DModel.count({ where: { id } });
    if (!exists) throw notFound("record");
    if (add.length) await tx.deviceModel.updateMany({ where: { id: { in: add } }, data: { model3dId: id } });
    if (remove.length) await tx.deviceModel.updateMany({ where: { id: { in: remove }, model3dId: id }, data: { model3dId: null } });
    await audit(tx, actor, { action: "device3d.assign", entityType: "Device3DModel", entityId: id, after: { add, remove } });
  });
  return { ok: true };
}

/**
 * Fill the backend in one go: one 3D model per customizable device, named after it, using its camera layout
 * and real dimensions (src/server/modules/catalog/device-dimensions.ts). Devices still on the automatic body
 * or on a shared layout model are moved to their own model; existing per-device models only gain missing
 * dimensions, never lose edits or uploaded files.
 */
export async function generateDefaultModels(actor: Actor | null) {
  assertCan(actor, "catalog.manage");
  const devices = await db.deviceModel.findMany({
    where: { category: { slug: { in: [...CUSTOMIZABLE_CATEGORIES] } } },
    select: { id: true, slug: true, name: true, frame: true, model3d: { select: { slug: true } }, brand: { select: { slug: true, name: true } }, category: { select: { slug: true } } },
  });
  const existing = new Map((await db.device3DModel.findMany({ select: { id: true, slug: true, params: true } })).map((m) => [m.slug, m]));
  let created = 0;
  let updated = 0;
  let linked = 0;
  let withSize = 0;
  for (const d of devices) {
    const slug = `${d.brand.slug}-${d.slug}`.slice(0, 80);
    const dims = DEVICE_DIMENSIONS[`${d.brand.name}|${d.name}`];
    if (dims) withSize++;
    const size = dims ? { heightMm: dims[0], widthMm: dims[1], thicknessMm: dims[2] } : {};
    const frame = isFrameKey(d.frame) ? d.frame : DEFAULT_FRAME[deviceKindFor(d.category.slug)];
    let row = existing.get(slug);
    if (!row) {
      const createdRow = await db.device3DModel.create({ data: { slug, name: `${d.brand.name} ${d.name}`, frame, params: size, notes: dims ? "Real dimensions from spec sheets." : "Dimensions unknown: add them below." } });
      row = { id: createdRow.id, slug, params: size };
      created++;
    } else if (dims && !readParams(row.params).heightMm) {
      await db.device3DModel.update({ where: { id: row.id }, data: { params: { ...readParams(row.params), ...size } } });
      updated++;
    }
    const onShared = !d.model3d || d.model3d.slug.startsWith("auto-");
    if (onShared && d.model3d?.slug !== slug) {
      await db.deviceModel.update({ where: { id: d.id }, data: { model3dId: row.id } });
      linked++;
    }
  }
  await db.$transaction(async (tx) => audit(tx, actor, { action: "device3d.generate_defaults", entityType: "Device3DModel", entityId: "*", after: { created, updated, linked, withSize } }));
  return { created, updated, linked, withSize, total: devices.length };
}

// ───────────── .glb upload ─────────────

const GLB_MIME = "model/gltf-binary";

/** Step 1: where the browser should send the file — a signed bucket URL, or this app (local storage). */
export async function startGlbUpload(actor: Actor | null, id: string, size: number) {
  assertCan(actor, "catalog.manage");
  if (!Number.isFinite(size) || size <= 0) throw new AppError("VALIDATION", "errors.upload.empty");
  if (size > MAX_GLB_BYTES) throw new AppError("VALIDATION", "errors.upload.tooLarge");
  await enforce(`glb:${actor.userId}`, 3600, 60);
  if (!(await db.device3DModel.count({ where: { id } }))) throw notFound("record");
  const key = `models3d/${id}/${randomUUID()}.glb`;
  const url = await storage().signedPutUrl(key, GLB_MIME, 600);
  return url ? { mode: "presigned" as const, url, key, contentType: GLB_MIME } : { mode: "direct" as const, key };
}

/** Direct upload (local storage, or small files): the app stores the bytes itself. */
export async function putGlbDirect(actor: Actor | null, id: string, key: string, body: Buffer) {
  assertCan(actor, "catalog.manage");
  checkKey(id, key);
  checkGlb(body);
  await storage().put(key, body, GLB_MIME);
  return finishGlbUpload(actor, id, key);
}

/** Step 2: verify the stored object really is a glTF binary, then attach it (replacing any previous file). */
export async function finishGlbUpload(actor: Actor | null, id: string, key: string) {
  assertCan(actor, "catalog.manage");
  checkKey(id, key);
  let body: Buffer;
  try {
    body = await storage().read(key);
  } catch {
    throw new AppError("VALIDATION", "errors.upload.empty");
  }
  try {
    checkGlb(body);
  } catch (e) {
    await storage().remove(key).catch(() => {});
    throw e;
  }
  const old = await db.$transaction(async (tx) => {
    const model = await tx.device3DModel.findUnique({ where: { id }, include: { file: true } });
    if (!model) throw notFound("record");
    const media = await tx.mediaAsset.create({
      data: { storageKey: key, mime: GLB_MIME, sizeBytes: body.byteLength, purpose: "DEVICE_MODEL_3D", isPublic: true, uploadedById: actor.userId, altEn: model.name },
    });
    await tx.device3DModel.update({ where: { id }, data: { fileId: media.id } });
    if (model.file) await tx.mediaAsset.delete({ where: { id: model.file.id } });
    await audit(tx, actor, { action: "device3d.upload", entityType: "Device3DModel", entityId: id, after: { fileId: media.id, sizeBytes: body.byteLength } });
    return model.file;
  });
  if (old) await storage().remove(old.storageKey).catch(() => {});
  return { ok: true };
}

/** Back to the generated body. */
export async function removeGlb(actor: Actor | null, id: string) {
  assertCan(actor, "catalog.manage");
  const file = await db.$transaction(async (tx) => {
    const model = await tx.device3DModel.findUnique({ where: { id }, include: { file: true } });
    if (!model) throw notFound("record");
    if (!model.file) return null;
    await tx.device3DModel.update({ where: { id }, data: { fileId: null } });
    await tx.mediaAsset.delete({ where: { id: model.file.id } });
    await audit(tx, actor, { action: "device3d.remove_file", entityType: "Device3DModel", entityId: id });
    return model.file;
  });
  if (file) await storage().remove(file.storageKey).catch(() => {});
  return { ok: true };
}

function checkKey(id: string, key: string) {
  if (!new RegExp(`^models3d/${id.replace(/[^\w-]/g, "")}/[0-9a-f-]{36}\\.glb$`).test(key)) throw new AppError("VALIDATION", "errors.validation");
}

/** glTF 2.0 binary header: magic "glTF", version 2, declared length = file length. */
function checkGlb(body: Buffer) {
  if (body.byteLength === 0) throw new AppError("VALIDATION", "errors.upload.empty");
  if (body.byteLength > MAX_GLB_BYTES) throw new AppError("VALIDATION", "errors.upload.tooLarge");
  const ok = body.byteLength >= 20 && body.readUInt32LE(0) === 0x46546c67 && body.readUInt32LE(4) === 2 && body.readUInt32LE(8) === body.byteLength;
  if (!ok) throw new AppError("VALIDATION", "errors.upload.type");
}
