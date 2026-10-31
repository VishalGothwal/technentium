"use client";
import { useState, type ReactNode } from "react";
import { Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { BLOCK_TYPES, CTA_KINDS, type BlockType, type ContentBlock } from "@/lib/schemas/content";
import { ImageUpload } from "./media-upload";
import { RelationPicker, type RelationOption } from "./relation-picker";

/** Editor-side block: a content block plus a stable key and, for related blocks, display labels. */
export type EditorBlock = ContentBlock & { _key: string; _labels?: RelationOption[] };

let seq = 0;
export const withKeys = (blocks: ContentBlock[], labels: RelationOption[] = []): EditorBlock[] =>
  blocks.map((b) => ({
    ...b,
    _key: `b${++seq}`,
    ...(b.type === "related" ? { _labels: b.items.map((it) => labels.find((l) => l.targetType === it.targetType && l.targetId === it.targetId) ?? { ...it, label: "(linked item)", hint: it.targetType }) } : {}),
  }));
export const stripKeys = (blocks: EditorBlock[]): ContentBlock[] =>
  blocks.map(({ _key, _labels, ...b }) => {
    void _key;
    void _labels;
    // Blank lines in a list textarea are not list items.
    return (b.type === "list" ? { ...b, items: b.items.map((s) => s.trim()).filter(Boolean) } : b) as ContentBlock;
  });

const LABELS: Record<BlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  list: "List",
  quote: "Quote",
  image: "Image",
  video: "Video",
  callout: "Callout",
  cta: "Call to action",
  related: "Related links",
};

function blank(type: BlockType): ContentBlock {
  switch (type) {
    case "heading":
      return { type, level: 2, text: "" };
    case "paragraph":
      return { type, text: "" };
    case "list":
      return { type, style: "bullet", items: [""] };
    case "quote":
      return { type, text: "" };
    case "image":
      return { type, mediaId: "", alt: "" };
    case "video":
      return { type, url: "" };
    case "callout":
      return { type, tone: "tip", text: "" };
    case "cta":
      return { type, kind: "repair" };
    case "related":
      return { type, items: [] as never };
  }
}

/**
 * Structured block editor (FR-CMS-02): add, reorder and remove headings, paragraphs, lists, quotes,
 * images (uploaded with alt text), video embeds, callouts, CTAs and related-content blocks.
 * Inline formatting: **bold**, *italic*, [label](https://… or /path).
 */
export function BlockEditor({ blocks, onChange, errors }: { blocks: EditorBlock[]; onChange: (b: EditorBlock[]) => void; errors?: Record<string, string> }) {
  const [adderAt, setAdderAt] = useState<number | null>(null);
  const update = (i: number, patch: Partial<ContentBlock> & { _labels?: RelationOption[] }) => onChange(blocks.map((b, j) => (j === i ? ({ ...b, ...patch } as EditorBlock) : b)));
  const insert = (at: number, type: BlockType) => {
    const next = [...blocks];
    next.splice(at, 0, { ...blank(type), _key: `b${++seq}`, ...(type === "related" ? { _labels: [] } : {}) } as EditorBlock);
    onChange(next);
    setAdderAt(null);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Formatting: <code>**bold**</code>, <code>*italic*</code>, <code>[link text](/en/repairs)</code>. HTML is not allowed.
      </p>
      {blocks.length === 0 && <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">No content yet. Add your first block below.</p>}
      {blocks.map((b, i) => {
        const err = errors && Object.entries(errors).find(([k]) => k.match(new RegExp(`(^|\\.)body\\.${i}(\\.|$)`)))?.[1];
        return (
          <div key={b._key}>
            <div className={cn("rounded-xl border bg-surface", err ? "border-danger" : "border-border")}>
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
                <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {i + 1}. {LABELS[b.type]}
                </span>
                <span className="flex gap-1">
                  <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                    ↑
                  </IconBtn>
                  <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}>
                    ↓
                  </IconBtn>
                  <IconBtn label="Remove block" danger onClick={() => onChange(blocks.filter((_, j) => j !== i))}>
                    ✕
                  </IconBtn>
                </span>
              </div>
              <div className="space-y-2 p-3">
                <BlockFields block={b} onChange={(patch) => update(i, patch)} />
                {err && (
                  <p className="text-sm text-danger" role="alert">
                    {err}
                  </p>
                )}
              </div>
            </div>
            <Adder open={adderAt === i + 1} onOpen={() => setAdderAt(adderAt === i + 1 ? null : i + 1)} onPick={(t) => insert(i + 1, t)} compact />
          </div>
        );
      })}
      {blocks.length === 0 && <Adder open={adderAt === 0} onOpen={() => setAdderAt(adderAt === 0 ? null : 0)} onPick={(t) => insert(0, t)} />}
    </div>
  );
}

function Adder({ open, onOpen, onPick, compact }: { open: boolean; onOpen: () => void; onPick: (t: BlockType) => void; compact?: boolean }) {
  return (
    <div className={cn("relative flex justify-center", compact ? "py-1" : "py-2")}>
      <button type="button" onClick={onOpen} aria-expanded={open} className="rounded-full border border-dashed border-border bg-background px-3 py-0.5 text-xs font-medium text-muted hover:border-primary hover:text-primary">
        + Add block
      </button>
      {open && (
        <div className="absolute top-full z-10 mt-1 flex max-w-md flex-wrap justify-center gap-1 rounded-xl border border-border bg-surface p-2 shadow-lg">
          {BLOCK_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => onPick(t)} className="rounded-md px-2.5 py-1.5 text-sm hover:bg-primary-soft hover:text-primary">
              {LABELS[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={cn("flex size-7 items-center justify-center rounded-md text-sm disabled:opacity-30", danger ? "text-danger hover:bg-danger-soft" : "text-muted hover:bg-surface-muted")}>
      {children}
    </button>
  );
}

function BlockFields({ block: b, onChange }: { block: EditorBlock; onChange: (patch: Partial<ContentBlock> & { _labels?: RelationOption[] }) => void }) {
  switch (b.type) {
    case "heading":
      return (
        <div className="flex gap-2">
          <Select aria-label="Heading level" value={b.level} onChange={(e) => onChange({ level: Number(e.target.value) as 2 | 3 })} className="h-10 w-24">
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </Select>
          <Input aria-label="Heading text" value={b.text} onChange={(e) => onChange({ text: e.target.value })} className={cn("h-10 font-semibold", b.level === 2 && "text-lg")} placeholder="Section heading" />
        </div>
      );
    case "paragraph":
      return <Textarea aria-label="Paragraph" value={b.text} onChange={(e) => onChange({ text: e.target.value })} rows={Math.min(12, Math.max(3, Math.ceil(b.text.length / 90)))} placeholder="Write a paragraph…" />;
    case "list":
      return (
        <div className="space-y-2">
          <Select aria-label="List style" value={b.style} onChange={(e) => onChange({ style: e.target.value as "bullet" | "number" })} className="h-10 w-40">
            <option value="bullet">Bulleted</option>
            <option value="number">Numbered</option>
          </Select>
          <Textarea aria-label="List items, one per line" value={b.items.join("\n")} onChange={(e) => onChange({ items: e.target.value.split("\n") })} rows={Math.max(3, b.items.length + 1)} placeholder="One item per line" />
        </div>
      );
    case "quote":
      return (
        <div className="space-y-2">
          <Textarea aria-label="Quote" value={b.text} onChange={(e) => onChange({ text: e.target.value })} rows={2} />
          <Input aria-label="Attribution" value={b.cite ?? ""} onChange={(e) => onChange({ cite: e.target.value || undefined })} className="h-10" placeholder="Attribution (optional)" />
        </div>
      );
    case "image":
      return (
        <div className="space-y-2">
          <ImageUpload value={b.mediaId || null} onChange={(id) => onChange({ mediaId: id ?? "" })} />
          <Input aria-label="Alt text" value={b.alt} onChange={(e) => onChange({ alt: e.target.value })} className="h-10" placeholder="Alt text — describe the image for screen readers (required)" />
          <Input aria-label="Caption" value={b.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value || undefined })} className="h-10" placeholder="Caption (optional)" />
        </div>
      );
    case "video":
      return (
        <div className="space-y-2">
          <Input aria-label="Video URL" value={b.url} onChange={(e) => onChange({ url: e.target.value })} className="h-10" placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…" />
          <Input aria-label="Video title" value={b.title ?? ""} onChange={(e) => onChange({ title: e.target.value || undefined })} className="h-10" placeholder="Title (optional, used for accessibility)" />
        </div>
      );
    case "callout":
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Select aria-label="Callout tone" value={b.tone} onChange={(e) => onChange({ tone: e.target.value as "tip" | "warning" | "info" })} className="h-10 w-36">
              <option value="tip">Tip</option>
              <option value="warning">Warning</option>
              <option value="info">Good to know</option>
            </Select>
            <Input aria-label="Callout title" value={b.title ?? ""} onChange={(e) => onChange({ title: e.target.value || undefined })} className="h-10" placeholder="Title (optional)" />
          </div>
          <Textarea aria-label="Callout text" value={b.text} onChange={(e) => onChange({ text: e.target.value })} rows={2} />
        </div>
      );
    case "cta":
      return (
        <div className="space-y-2">
          <Select aria-label="Call to action" value={b.kind} onChange={(e) => onChange({ kind: e.target.value as (typeof CTA_KINDS)[number] })} className="h-10 w-56">
            <option value="repair">Book a repair</option>
            <option value="protection">Shop protection</option>
            <option value="customize">Customization studio</option>
            <option value="specs">Compare phones</option>
          </Select>
          <Input aria-label="CTA title" value={b.title ?? ""} onChange={(e) => onChange({ title: e.target.value || undefined })} className="h-10" placeholder="Custom title (optional — default text is translated)" />
          <Input aria-label="CTA text" value={b.text ?? ""} onChange={(e) => onChange({ text: e.target.value || undefined })} className="h-10" placeholder="Custom text (optional)" />
        </div>
      );
    case "related":
      return (
        <div className="space-y-2">
          <Input aria-label="Related block title" value={b.title ?? ""} onChange={(e) => onChange({ title: e.target.value || undefined })} className="h-10" placeholder="Title (optional, e.g. “Read next”)" />
          <RelationPicker
            value={b._labels ?? []}
            max={6}
            onChange={(opts) => onChange({ items: opts.map(({ targetType, targetId }) => ({ targetType, targetId })), _labels: opts })}
          />
        </div>
      );
  }
}
