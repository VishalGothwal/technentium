import type { ContentBlock } from "@/lib/schemas/content";
import { plainText } from "./inline";

/** Stable anchor id for a heading (keeps Devanagari letters; strips punctuation). */
export function headingId(text: string, used?: Map<string, number>): string {
  const base =
    plainText(text)
      .toLowerCase()
      .normalize("NFC")
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section";
  if (!used) return base;
  const n = used.get(base) ?? 0;
  used.set(base, n + 1);
  return n === 0 ? base : `${base}-${n + 1}`;
}

export type TocEntry = { id: string; text: string; level: 2 | 3 };

/** Headings with their anchor ids, in document order (ids match what BlockRenderer assigns). */
export function tableOfContents(blocks: ContentBlock[]): TocEntry[] {
  const used = new Map<string, number>();
  return blocks.flatMap((b) => (b.type === "heading" ? [{ id: headingId(b.text, used), text: plainText(b.text), level: b.level }] : []));
}

export function blocksToText(blocks: ContentBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "heading":
        case "paragraph":
        case "quote":
        case "callout":
          return plainText(b.text);
        case "list":
          return b.items.map(plainText).join(" ");
        default:
          return "";
      }
    })
    .join(" ");
}

/** ~200 words per minute (a conservative pace that also suits Hindi readers); minimum one minute. */
export function readingMinutes(blocks: ContentBlock[]): number {
  const words = blocksToText(blocks).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
