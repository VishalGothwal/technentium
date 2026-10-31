import { z } from "zod";

/**
 * Generative design styles. A design is stored as parameters, not as an image, so the same
 * preview renders identically in the studio, the customer's account and the admin console.
 */
export const PATTERNS = ["solid", "gradient", "waves", "grid", "dots", "stripes", "topo", "blobs", "chevron", "terrazzo", "sunburst", "checker", "letters"] as const;
export type PatternKey = (typeof PATTERNS)[number];

export const COLLECTIONS = ["minimal", "nature", "abstract", "gradient", "typography", "retro"] as const;
export type CollectionKey = (typeof COLLECTIONS)[number];

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "validation.invalid");

export const designStyleSchema = z.object({
  pattern: z.enum(PATTERNS),
  palette: z.array(hexColor).min(2, "validation.invalid").max(5, "validation.invalid"),
  /** 1 (sparse) … 10 (dense). */
  density: z.number().int().min(1).max(10).default(5),
  /** Degrees, used by gradient/stripes/chevron. */
  angle: z.number().int().min(0).max(360).default(45),
});
export type DesignStyle = z.output<typeof designStyleSchema>;

export const DEFAULT_STYLE: DesignStyle = { pattern: "solid", palette: ["#1f2937", "#9ca3af"], density: 5, angle: 45 };

/** Parse a stored style; anything malformed falls back to a neutral solid so a bad row never breaks a page. */
export function readStyle(value: unknown): DesignStyle {
  const parsed = designStyleSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_STYLE;
}

export const TEXT_FONTS = ["sans", "serif", "mono", "script", "display"] as const;
export const TEXT_POSITIONS = ["top", "center", "bottom"] as const;
export type TextFont = (typeof TEXT_FONTS)[number];
export type TextPosition = (typeof TEXT_POSITIONS)[number];

export const FONT_FAMILIES: Record<TextFont, string> = {
  sans: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'Cascadia Mono', Menlo, monospace",
  script: "'Segoe Script', 'Brush Script MT', cursive",
  display: "Impact, 'Arial Black', sans-serif",
};

/** Device silhouettes the studio can render; other categories (watches, audio) are not customizable yet. */
export const CUSTOMIZABLE_CATEGORIES = ["phone", "tablet", "laptop"] as const;
export type DeviceKind = (typeof CUSTOMIZABLE_CATEGORIES)[number];
export const deviceKindFor = (categorySlug: string): DeviceKind =>
  (CUSTOMIZABLE_CATEGORIES as readonly string[]).includes(categorySlug) ? (categorySlug as DeviceKind) : "phone";
