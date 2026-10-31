import { z } from "zod";
import { customizationArtworkSchema, customizationTextSchema } from "@/lib/schemas/customization";
import { DEFAULT_STYLE, designStyleSchema, type DesignStyle, type DeviceKind } from "./style";

/**
 * FR-CUSTOM-05: configuration snapshot saved with a request. Built by the server from validated
 * ids (names and prices are never taken from the client) and re-rendered by the preview anywhere.
 */
export type CustomizationConfig = {
  version: 1;
  /** `frame` (2D outline family) was added later; older snapshots omit it and render the generic shape. */
  device: { id: string; name: string; brand: string; kind: DeviceKind; frame?: string | null };
  design: { id: string; slug: string; nameEn: string; nameHi: string | null } | null;
  style: DesignStyle;
  finish: { id: string; slug: string; nameEn: string; nameHi: string | null; deltaPaise: number };
  coverage: { id: string; slug: string; nameEn: string; nameHi: string | null; deltaPaise: number };
  text: z.output<typeof customizationTextSchema> | null;
  artwork: z.output<typeof customizationArtworkSchema> | null;
  estimate: { basePaise: number; finishPaise: number; coveragePaise: number; totalPaise: number };
};

const optionSnap = z.object({ id: z.string(), slug: z.string(), nameEn: z.string(), nameHi: z.string().nullable(), deltaPaise: z.number() });

const configSchema = z.object({
  version: z.literal(1),
  device: z.object({ id: z.string(), name: z.string(), brand: z.string(), kind: z.enum(["phone", "tablet", "laptop"]), frame: z.string().nullish() }),
  design: z.object({ id: z.string(), slug: z.string(), nameEn: z.string(), nameHi: z.string().nullable() }).nullable(),
  style: designStyleSchema,
  finish: optionSnap,
  coverage: optionSnap,
  text: customizationTextSchema.nullable(),
  artwork: customizationArtworkSchema.nullable(),
  estimate: z.object({ basePaise: z.number(), finishPaise: z.number(), coveragePaise: z.number(), totalPaise: z.number() }),
});

/** Read a stored snapshot defensively (older or hand-edited rows degrade to a neutral preview). */
export function readConfig(value: unknown): CustomizationConfig | null {
  const parsed = configSchema.safeParse(value);
  return parsed.success ? (parsed.data as CustomizationConfig) : null;
}

export const FALLBACK_STYLE = DEFAULT_STYLE;
