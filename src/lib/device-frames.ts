import type { DeviceKind } from "@/lib/customization/style";

/**
 * 2D device outlines grouped by camera layout ("frame families"). Every DeviceModel stores a family key
 * (`DeviceModel.frame`); models without one fall back to their category's default. Coordinates are in the
 * device's own units (back view, camera top-left as seen from behind) and are only an illustration of the
 * real layout, not manufacturing dimensions.
 */

export type RectShape = { shape: "rect"; x: number; y: number; w: number; h: number; r: number };
export type CircleShape = { shape: "circle"; cx: number; cy: number; r: number };
export type ModuleShape = RectShape | CircleShape;
/** Front cut-out style: Dynamic Island, notch, centred or corner punch-hole, thick bezels with a home button, or none (laptop lid). */
export type FrontStyle = "island" | "notch" | "punch-center" | "punch-left" | "bezel" | "none";

/** [cx, cy, r] */
export type Circle = readonly [x: number, y: number, r: number];

export type FrameGeometry = {
  kind: DeviceKind;
  label: string;
  w: number;
  h: number;
  r: number;
  /** Raised camera islands; a "camera" coverage skin wraps exactly these shapes. */
  modules: readonly ModuleShape[];
  lenses: readonly Circle[];
  flash: readonly Circle[];
  logo: Circle | null;
  /** Outer display on a flip phone's back (never skinned). */
  cover?: Omit<RectShape, "shape">;
  /** y of the fold line on flip phones. */
  hinge?: number;
  /** Nothing-style light strips drawn over the back. */
  glyph?: boolean;
  front: FrontStyle;
  /** Vertical position of top-aligned text, as a fraction of height (keeps text clear of the cameras). */
  textTop: number;
};

const rect = (x: number, y: number, w: number, h: number, r: number): RectShape => ({ shape: "rect", x, y, w, h, r });
const circle = (cx: number, cy: number, r: number): CircleShape => ({ shape: "circle", cx, cy, r });
const phone = { kind: "phone", w: 300, h: 620, r: 46, logo: null, textTop: 0.42 } as const;

const IPHONE_PRO = { ...phone, modules: [rect(16, 16, 156, 156, 40)], lenses: [[56, 56, 28], [56, 132, 28], [128, 94, 28]], flash: [[128, 40, 8]] } as const;
const IPHONE_DUAL = { ...phone, modules: [rect(18, 18, 130, 130, 34)], flash: [[113, 50, 7]] } as const;

export const FRAME_FAMILIES = {
  "iphone-pro": { ...IPHONE_PRO, label: "iPhone Pro · triple, Dynamic Island", front: "island" },
  "iphone-pro-notch": { ...IPHONE_PRO, label: "iPhone Pro · triple, notch", front: "notch" },
  "iphone-pro-plateau": {
    ...phone,
    label: "iPhone Pro · full-width camera plateau",
    modules: [rect(10, 14, 280, 172, 40)],
    lenses: [[56, 60, 28], [56, 140, 28], [124, 100, 28]],
    flash: [[244, 66, 8]],
    front: "island",
  },
  "iphone-air": { ...phone, label: "iPhone Air · single lens plateau", modules: [rect(10, 14, 280, 110, 40)], lenses: [[62, 69, 28]], flash: [[124, 69, 8]], front: "island" },
  "iphone-dual-square": { ...IPHONE_DUAL, label: "iPhone · dual vertical, notch", lenses: [[53, 53, 24], [53, 113, 24]], front: "notch" },
  "iphone-dual-diagonal": { ...IPHONE_DUAL, label: "iPhone · dual diagonal, notch", lenses: [[53, 53, 24], [113, 113, 24]], front: "notch" },
  "iphone-dual-diagonal-island": { ...IPHONE_DUAL, label: "iPhone · dual diagonal, Dynamic Island", lenses: [[53, 53, 24], [113, 113, 24]], front: "island" },
  "iphone-dual-vertical": {
    ...phone,
    label: "iPhone · dual vertical pill",
    modules: [rect(20, 20, 66, 136, 33)],
    lenses: [[53, 53, 25], [53, 123, 25]],
    flash: [[108, 40, 7]],
    front: "island",
  },
  "iphone-single": { ...phone, label: "iPhone · single lens", modules: [rect(20, 20, 70, 70, 22)], lenses: [[55, 55, 24]], flash: [[106, 40, 7]], front: "notch" },
  "iphone-se": { ...phone, label: "iPhone SE · home button", w: 280, h: 580, r: 40, modules: [], lenses: [[40, 40, 16]], flash: [[74, 40, 6]], front: "bezel" },
  "galaxy-s": { ...phone, label: "Galaxy S / A / M · vertical lenses", modules: [], lenses: [[50, 52, 25], [50, 118, 25], [50, 184, 25]], flash: [[100, 52, 7]], front: "punch-center" },
  "galaxy-ultra": {
    ...phone,
    label: "Galaxy Ultra · five lenses",
    r: 24,
    modules: [],
    lenses: [[50, 52, 25], [50, 118, 25], [50, 184, 25], [112, 86, 19], [112, 150, 19]],
    flash: [[112, 206, 7]],
    front: "punch-center",
  },
  "galaxy-fold": {
    ...phone,
    label: "Book-style foldable (closed)",
    w: 250,
    r: 30,
    modules: [rect(16, 16, 68, 206, 34)],
    lenses: [[50, 52, 24], [50, 119, 24], [50, 186, 24]],
    flash: [[112, 40, 7]],
    front: "punch-center",
  },
  "galaxy-flip": {
    ...phone,
    label: "Flip foldable (open)",
    h: 680,
    r: 40,
    modules: [],
    cover: { x: 14, y: 14, w: 272, h: 296, r: 30 },
    hinge: 340,
    lenses: [[58, 58, 24], [58, 124, 24]],
    flash: [[104, 40, 7]],
    front: "punch-center",
  },
  "pixel-bar": { ...phone, label: "Pixel · camera bar", modules: [rect(24, 92, 252, 96, 48)], lenses: [[86, 140, 28], [150, 140, 28]], flash: [[214, 140, 9]], front: "punch-center" },
  "round-center": {
    ...phone,
    label: "Large round module, centred",
    modules: [circle(150, 140, 100)],
    lenses: [[112, 104, 30], [188, 104, 30], [112, 178, 30]],
    flash: [[188, 178, 10]],
    front: "punch-center",
  },
  "round-corner": {
    ...phone,
    label: "Round module, corner",
    modules: [circle(100, 100, 80)],
    lenses: [[72, 72, 24], [128, 72, 24], [72, 128, 24]],
    flash: [[128, 128, 8]],
    front: "punch-center",
  },
  "square-corner": {
    ...phone,
    label: "Square module, corner",
    modules: [rect(18, 18, 140, 140, 32)],
    lenses: [[58, 58, 25], [118, 58, 25], [58, 118, 25]],
    flash: [[118, 118, 8]],
    front: "punch-center",
  },
  "pill-vertical": { ...phone, label: "Tall pill module", modules: [rect(20, 20, 84, 214, 42)], lenses: [[62, 64, 30], [62, 146, 30]], flash: [[62, 208, 8]], front: "punch-center" },
  "pill-horizontal": {
    ...phone,
    label: "Centred horizontal pill (Nothing a-series)",
    modules: [rect(85, 40, 130, 70, 35)],
    lenses: [[120, 75, 24], [180, 75, 24]],
    flash: [[150, 132, 6]],
    glyph: true,
    front: "punch-center",
  },
  "nothing-glyph": {
    ...phone,
    label: "Nothing · glyph lights",
    modules: [rect(18, 18, 130, 70, 35)],
    lenses: [[53, 53, 24], [113, 53, 24]],
    flash: [[60, 112, 6]],
    glyph: true,
    front: "punch-center",
  },
  tablet: { kind: "tablet", label: "Tablet", w: 440, h: 600, r: 30, modules: [rect(22, 22, 74, 74, 22)], lenses: [[59, 59, 19]], flash: [], logo: null, front: "bezel", textTop: 0.3 },
  laptop: { kind: "laptop", label: "Laptop lid", w: 600, h: 400, r: 20, modules: [], lenses: [], flash: [], logo: [300, 200, 26], front: "none", textTop: 0.24 },
} satisfies Record<string, FrameGeometry>;

export type FrameKey = keyof typeof FRAME_FAMILIES;
export const FRAME_KEYS = Object.keys(FRAME_FAMILIES) as FrameKey[];
/** Own keys only — `in` would also accept inherited names like "constructor". */
export const isFrameKey = (v: unknown): v is FrameKey => typeof v === "string" && Object.hasOwn(FRAME_FAMILIES, v);

/** Family used when a model has no (or an unknown) frame: the generic look for its kind. */
export const DEFAULT_FRAME: Record<DeviceKind, FrameKey> = { phone: "square-corner", tablet: "tablet", laptop: "laptop" };

/** A side key, as seen from the FRONT: `top` and `length` are fractions of the body height. */
export type SideButton = { side: "left" | "right"; top: number; length: number };
/** Bottom-edge openings, as fractions of the width from the centre. */
export type Ports = { usb: boolean; speakers: boolean };

/** Side keys and ports for a frame family (iPhones: action + volume left, power right; most Androids: all right). */
export function hardwareFor(frame: string | null | undefined, kind: DeviceKind): { buttons: SideButton[]; ports: Ports } {
  if (kind === "laptop") return { buttons: [], ports: { usb: false, speakers: false } };
  if (kind === "tablet") return { buttons: [{ side: "right", top: 0.04, length: 0.07 }, { side: "right", top: 0.13, length: 0.09 }], ports: { usb: true, speakers: true } };
  const key = isFrameKey(frame) ? frame : DEFAULT_FRAME.phone;
  if (key.startsWith("iphone"))
    return {
      buttons: [
        { side: "left", top: 0.16, length: 0.045 },
        { side: "left", top: 0.25, length: 0.085 },
        { side: "left", top: 0.36, length: 0.085 },
        { side: "right", top: 0.28, length: 0.13 },
      ],
      ports: { usb: true, speakers: true },
    };
  if (key === "galaxy-flip") return { buttons: [{ side: "right", top: 0.36, length: 0.09 }, { side: "right", top: 0.47, length: 0.06 }], ports: { usb: true, speakers: true } };
  return { buttons: [{ side: "right", top: 0.2, length: 0.13 }, { side: "right", top: 0.37, length: 0.07 }], ports: { usb: true, speakers: true } };
}

/** Geometry for a model's frame key, falling back to the kind's default (and to phone for anything else). */
export function frameFor(frame: string | null | undefined, kind: DeviceKind = "phone"): FrameGeometry {
  return FRAME_FAMILIES[isFrameKey(frame) ? frame : DEFAULT_FRAME[kind] ?? "square-corner"];
}

/**
 * The frame at a model's real proportions (height / width from its dimensions in mm). The camera layout stays
 * anchored to the top-left so lenses keep their shape; only the body gets taller or shorter.
 */
export function sizedFrame(g: FrameGeometry, aspect: number | null | undefined): FrameGeometry {
  if (!aspect || !Number.isFinite(aspect)) return g;
  const h = Math.round(Math.min(Math.max(aspect, 0.4), 3) * g.w);
  if (h === g.h) return g;
  const k = h / g.h;
  return { ...g, h, hinge: g.hinge ? g.hinge * k : g.hinge, cover: g.cover ? { ...g.cover, h: g.cover.h * k } : g.cover };
}

/** Front view: the display area and the cut-outs drawn on top of it (island, notch, punch-hole, home button, webcam). */
export function frontLayout(g: FrameGeometry): { screen: Omit<RectShape, "shape">; cutouts: ModuleShape[] } {
  const { w, h } = g;
  if (g.front === "bezel") {
    const v = g.kind === "tablet" ? 34 : 74;
    const side = g.kind === "tablet" ? 34 : 16;
    const cutouts: ModuleShape[] = g.kind === "tablet" ? [circle(w / 2, 17, 4)] : [rect(w / 2 - 30, 32, 60, 8, 4), circle(w / 2, h - 37, 22)];
    return { screen: { x: side, y: v, w: w - side * 2, h: h - v * 2, r: 6 }, cutouts };
  }
  const inset = g.kind === "laptop" ? 16 : 8;
  const screen = { x: inset, y: inset, w: w - inset * 2, h: h - inset * 2, r: Math.max(4, g.r - inset) };
  const cutouts: Record<Exclude<FrontStyle, "bezel">, ModuleShape[]> = {
    island: [rect(w / 2 - 46, 22, 92, 27, 13.5)],
    notch: [rect(w / 2 - 74, 2, 148, 34, 16)],
    "punch-center": [circle(w / 2, 28, 9)],
    "punch-left": [circle(34, 28, 9)],
    none: [circle(w / 2, 9, 3)],
  };
  return { screen, cutouts: cutouts[g.front] };
}
