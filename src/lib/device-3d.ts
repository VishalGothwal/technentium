import { z } from "zod";
import type { DeviceKind } from "@/lib/customization/style";
import { DEFAULT_FRAME, isFrameKey } from "@/lib/device-frames";
import { mediaUrl } from "@/lib/media";

/**
 * 3D device bodies. Every customizable device renders in 3D: an uploaded .glb when its Device3DModel has one,
 * otherwise a body generated from the 2D frame family (src/lib/device-frames.ts) and these parameters.
 * Shared by the client viewer, the admin editor and the server (validation).
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const BODY_MATERIALS = ["aluminium", "titanium", "steel", "plastic", "glass"] as const;
export type BodyMaterial = (typeof BODY_MATERIALS)[number];

export const device3dParamsSchema = z.object({
  /** Real body size in mm (spec-sheet "height x width x thickness"); sets the proportions and thickness. */
  heightMm: z.number().min(20).max(500).optional(),
  widthMm: z.number().min(20).max(500).optional(),
  thicknessMm: z.number().min(2).max(40).optional(),
  /** Body thickness as a fraction of the width (a 7.8 mm phone 71.5 mm wide ≈ 0.11). */
  thickness: z.number().min(0.02).max(0.3).optional(),
  /** Corner radius override in frame units (the frame family's own radius when unset). */
  cornerRadius: z.number().min(0).max(120).optional(),
  /** Camera bump height as a fraction of the width. */
  bumpHeight: z.number().min(0).max(0.12).optional(),
  /** Height stretch (1 = the frame family's proportions), for taller or shorter models. */
  heightScale: z.number().min(0.7).max(1.4).optional(),
  /** Frame / rail colour. */
  bodyColor: hex.optional(),
  bodyMaterial: z.enum(BODY_MATERIALS).optional(),
  /** Back panel colour when no skin is applied (repair pages, admin preview). */
  backColor: hex.optional(),
  /** Uploaded .glb: uniform scale and rotation fix-ups, in degrees, if the file is not front-facing +Z with Y up. */
  glbScale: z.number().min(0.1).max(10).optional(),
  glbRotateX: z.number().min(-180).max(180).optional(),
  glbRotateY: z.number().min(-180).max(180).optional(),
  glbRotateZ: z.number().min(-180).max(180).optional(),
});
export type Device3DParams = z.output<typeof device3dParamsSchema>;

/** Parse stored params; anything malformed is dropped so a bad row never breaks a page. */
export function readParams(value: unknown): Device3DParams {
  const parsed = device3dParamsSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (!value || typeof value !== "object") return {};
  // Keep the individually valid keys.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const field = device3dParamsSchema.shape[k as keyof typeof device3dParamsSchema.shape];
    if (field && field.safeParse(v).success) out[k] = v;
  }
  return out as Device3DParams;
}

export const KIND_DEFAULTS: Record<DeviceKind, Required<Pick<Device3DParams, "thickness" | "bumpHeight" | "bodyColor" | "bodyMaterial" | "backColor">>> = {
  phone: { thickness: 0.11, bumpHeight: 0.035, bodyColor: "#4b5060", bodyMaterial: "aluminium", backColor: "#2a2e39" },
  tablet: { thickness: 0.035, bumpHeight: 0.015, bodyColor: "#6b7280", bodyMaterial: "aluminium", backColor: "#3a3f4b" },
  laptop: { thickness: 0.03, bumpHeight: 0, bodyColor: "#9ca3af", bodyMaterial: "aluminium", backColor: "#a8adb7" },
};

/** What a viewer needs to draw one device. Plain JSON: travels from server components and the device API. */
export type Device3DSpec = {
  frame: string | null;
  params: Device3DParams;
  /** Uploaded .glb, or null for the generated body. */
  glbUrl: string | null;
};

/** Shape of the `model3d` relation as the device selects return it. */
export type Device3DRow = { frame: string; params: unknown; fileId: string | null; active: boolean } | null | undefined;

/** Prisma select for the `model3d` relation (public reads). */
export const MODEL3D_SELECT = { select: { frame: true, params: true, fileId: true, active: true } } as const;

/** Resolve a device's 3D spec: its active Device3DModel, else a generated body from the device's own frame. */
export function resolveDevice3d(deviceFrame: string | null | undefined, row: Device3DRow, kind: DeviceKind = "phone"): Device3DSpec {
  if (row && row.active) {
    return { frame: isFrameKey(row.frame) ? row.frame : (deviceFrame ?? DEFAULT_FRAME[kind]), params: readParams(row.params), glbUrl: row.fileId ? mediaUrl(row.fileId) : null };
  }
  return { frame: deviceFrame ?? null, params: {}, glbUrl: null };
}

/** height / width from the real dimensions, if both are known. */
export const aspectOf = (p: Device3DParams) => (p.heightMm && p.widthMm ? p.heightMm / p.widthMm : null);

export const MAX_GLB_BYTES = 25 * 1024 * 1024;
