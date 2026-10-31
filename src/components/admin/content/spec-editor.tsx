"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { rupeesToPaise } from "@/lib/format";
import type { SpecGroup } from "@/lib/schemas/content";
import { comparisonStatusAction, saveComparisonAction, saveSpecAction, specStatusAction } from "@/app/admin/(console)/specs/actions";
import { ImageUpload } from "./media-upload";

type Status = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
const STATUS_TONE: Record<Status, "neutral" | "info" | "success" | "warning"> = { DRAFT: "neutral", SCHEDULED: "info", PUBLISHED: "success", ARCHIVED: "warning" };

function StatusBar({ status, canPublish, pending, onAction }: { status: Status; canPublish: boolean; pending: boolean; onAction: (a: "publish" | "unpublish" | "archive") => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
      <span className="text-sm">
        Status: <Badge tone={STATUS_TONE[status]}>{status.toLowerCase()}</Badge>
      </span>
      {canPublish ? (
        <span className="ml-auto flex gap-2">
          {status !== "PUBLISHED" && (
            <Button size="sm" onClick={() => onAction("publish")} pending={pending}>
              Publish
            </Button>
          )}
          {status === "PUBLISHED" && (
            <Button size="sm" variant="secondary" onClick={() => onAction("unpublish")} pending={pending}>
              Unpublish
            </Button>
          )}
          {status !== "ARCHIVED" && (
            <Button size="sm" variant="ghost" onClick={() => onAction("archive")} pending={pending}>
              Archive
            </Button>
          )}
        </span>
      ) : (
        <span className="ml-auto text-xs text-muted">Publishing needs the content.publish permission.</span>
      )}
    </div>
  );
}

export type SpecEditorInitial = {
  id: string | null;
  deviceModelId: string;
  deviceName: string;
  slug: string;
  status: Status;
  releaseDate: string | null;
  launchPricePaise: number | null;
  summaryEn: string;
  summaryHi: string;
  imageMediaId: string | null;
  seoTitle: string;
  metaDescription: string;
  specs: SpecGroup[];
};

/**
 * Specification sheet editor (FR-SPEC-05). Every value has an explicit "unknown" state, stored as null
 * and shown publicly as "Not available" — never confused with "No" or 0 (FR-SPEC-04).
 */
export function SpecEditor({ initial, canPublish }: { initial: SpecEditorInitial; canPublish: boolean }) {
  const router = useRouter();
  const { run, pending, error, fields } = useAction();
  const [s, setS] = useState(initial);
  const [price, setPrice] = useState(initial.launchPricePaise != null ? String(initial.launchPricePaise / 100) : "");
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<SpecEditorInitial>) => {
    setS((x) => ({ ...x, ...patch }));
    setSaved(false);
  };
  const setGroups = (fn: (g: SpecGroup[]) => SpecGroup[]) => set({ specs: fn(s.specs) });
  const setItem = (gi: number, ii: number, patch: Partial<SpecGroup["items"][number]>) =>
    setGroups((gs) => gs.map((g, i) => (i !== gi ? g : { ...g, items: g.items.map((it, j) => (j !== ii ? it : { ...it, ...patch })) })));

  const filled = s.specs.flatMap((g) => g.items).filter((i) => i.value !== null).length;
  const total = s.specs.flatMap((g) => g.items).length;

  function save() {
    const paise = price.trim() ? rupeesToPaise(price) : null;
    run(
      () =>
        saveSpecAction(s.id, {
          deviceModelId: s.deviceModelId,
          slug: s.slug,
          releaseDate: s.releaseDate || null,
          launchPricePaise: paise,
          summaryEn: s.summaryEn || undefined,
          summaryHi: s.summaryHi || undefined,
          imageMediaId: s.imageMediaId,
          seoTitle: s.seoTitle || undefined,
          metaDescription: s.metaDescription || undefined,
          specs: s.specs,
        }),
      (res) => {
        setSaved(true);
        if (!s.id) router.replace(`/admin/specs/${(res as { id: string }).id}`);
      },
    );
  }

  return (
    <div className="space-y-5 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/specs" className="text-sm text-muted hover:underline">
            ← Specs & comparisons
          </Link>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{s.deviceName}</h1>
          <p className="text-sm text-muted">
            {filled} of {total} values known
          </p>
        </div>
        <div className="flex gap-2">
          {s.id && s.status === "PUBLISHED" && (
            <Link href={`/en/specs/${initial.slug}`} target="_blank" className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-muted">
              View ↗
            </Link>
          )}
          <Button onClick={save} pending={pending}>
            {s.id ? "Save" : "Create draft"}
          </Button>
        </div>
      </div>
      {error && (
        <Alert tone="danger" title={error}>
          {Object.entries(fields)
            .slice(0, 5)
            .map(([k, v]) => (
              <p key={k}>
                <code className="text-xs">{k}</code>: {v}
              </p>
            ))}
        </Alert>
      )}
      {saved && !error && <Alert tone="success">Saved.</Alert>}
      {s.id && <StatusBar status={initial.status} canPublish={canPublish} pending={pending} onAction={(action) => run(() => specStatusAction(s.id!, { action }))} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {s.specs.map((g, gi) => (
            <section key={gi} className="rounded-xl border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
                <Input aria-label="Group label (English)" value={g.labelEn} onChange={(e) => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, labelEn: e.target.value } : x)))} className="h-9 max-w-48 font-semibold" />
                <Input aria-label="Group label (Hindi)" value={g.labelHi ?? ""} onChange={(e) => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, labelHi: e.target.value || undefined } : x)))} className="h-9 max-w-40" placeholder="Hindi label" lang="hi" />
                <Input aria-label="Group key" value={g.group} onChange={(e) => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, group: e.target.value } : x)))} className="h-9 max-w-32 font-mono text-xs" />
                <button type="button" className="ml-auto text-sm text-danger hover:underline" onClick={() => setGroups((gs) => gs.filter((_, i) => i !== gi))}>
                  Remove group
                </button>
              </div>
              <ul className="divide-y divide-border">
                {g.items.map((it, ii) => (
                  <li key={ii} className="grid gap-2 p-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center">
                    <div>
                      <Input aria-label="Label" value={it.labelEn} onChange={(e) => setItem(gi, ii, { labelEn: e.target.value })} className="h-9 text-sm" />
                      <p className="mt-0.5 font-mono text-[0.65rem] text-muted">{it.key}</p>
                    </div>
                    <Input
                      aria-label={`${it.labelEn} value`}
                      value={it.value ?? ""}
                      disabled={it.value === null}
                      onChange={(e) => setItem(gi, ii, { value: e.target.value })}
                      placeholder={it.value === null ? "Unknown — shown as “Not available”" : "Value, e.g. 6.1-inch or No"}
                      className={cn("h-9 text-sm", it.value === null && "italic")}
                    />
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                        <input type="checkbox" checked={it.value === null} onChange={(e) => setItem(gi, ii, { value: e.target.checked ? null : "" })} className="size-4" />
                        Unknown
                      </label>
                      <button type="button" aria-label={`Remove ${it.labelEn}`} className="text-sm text-danger" onClick={() => setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, items: x.items.filter((_, j) => j !== ii) } : x)))}>
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="p-3">
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={() => {
                    const key = window.prompt("Key for the new row (lowercase, e.g. ois):")?.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
                    if (key) setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, items: [...x.items, { key, labelEn: key.replace(/_/g, " "), value: null }] } : x)));
                  }}
                >
                  + Add row
                </button>
              </div>
            </section>
          ))}
          <Button
            variant="secondary"
            onClick={() => {
              const key = window.prompt("Key for the new group (lowercase, e.g. audio):")?.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
              if (key) setGroups((gs) => [...gs, { group: key, labelEn: key.replace(/_/g, " "), items: [] }]);
            }}
          >
            + Add group
          </Button>
        </div>
        <aside className="space-y-4">
          <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <Field label="URL slug" required error={fields.slug} hint={`/en/specs/${s.slug || "…"}`}>
              {(p) => <Input {...p} value={s.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} className="h-10 font-mono text-sm" />}
            </Field>
            <Field label="Release date" error={fields.releaseDate}>
              {(p) => <Input {...p} type="date" value={s.releaseDate ?? ""} onChange={(e) => set({ releaseDate: e.target.value || null })} className="h-10" />}
            </Field>
            <Field label="Launch price (₹)" hint="Leave empty if unknown">
              {(p) => <Input {...p} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="h-10" />}
            </Field>
            <Field label="Summary (English)" error={fields.summaryEn}>
              {(p) => <Textarea {...p} value={s.summaryEn} onChange={(e) => set({ summaryEn: e.target.value })} rows={3} />}
            </Field>
            <Field label="Summary (Hindi)" error={fields.summaryHi}>
              {(p) => <Textarea {...p} value={s.summaryHi} onChange={(e) => set({ summaryHi: e.target.value })} rows={3} lang="hi" />}
            </Field>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Device image</p>
              <ImageUpload value={s.imageMediaId} onChange={(id) => set({ imageMediaId: id })} purpose="DEVICE_IMAGE" label="Device image" />
            </div>
            <Field label="SEO title" error={fields.seoTitle}>
              {(p) => <Input {...p} value={s.seoTitle} onChange={(e) => set({ seoTitle: e.target.value })} maxLength={70} className="h-10" />}
            </Field>
            <Field label="Meta description" error={fields.metaDescription}>
              {(p) => <Textarea {...p} value={s.metaDescription} onChange={(e) => set({ metaDescription: e.target.value })} maxLength={170} rows={2} />}
            </Field>
          </section>
        </aside>
      </div>
    </div>
  );
}

export type ComparisonEditorInitial = {
  id: string | null;
  status: Status;
  slug: string;
  titleEn: string;
  titleHi: string;
  introEn: string;
  introHi: string;
  verdictEn: string;
  verdictHi: string;
  seoTitle: string;
  metaDescription: string;
  specIds: string[];
};

/** Curated comparison editor: 2–3 devices plus bilingual intro and verdict. */
export function ComparisonEditor({ initial, options, canPublish }: { initial: ComparisonEditorInitial; options: { id: string; label: string; status: string }[]; canPublish: boolean }) {
  const router = useRouter();
  const { run, pending, error, fields } = useAction();
  const [c, setC] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<ComparisonEditorInitial>) => {
    setC((x) => ({ ...x, ...patch }));
    setSaved(false);
  };
  const slots = [0, 1, 2];

  function save() {
    const { id, status, ...rest } = c;
    void status;
    run(
      () => saveComparisonAction(id, { ...rest, specIds: c.specIds.filter(Boolean) }),
      (res) => {
        setSaved(true);
        if (!id) router.replace(`/admin/specs/comparisons/${(res as { id: string }).id}`);
      },
    );
  }

  const text = (key: keyof ComparisonEditorInitial, label: string, area = false, lang?: string) => (
    <Field label={label} error={fields[key]}>
      {(p) =>
        area ? (
          <Textarea {...p} value={c[key] as string} onChange={(e) => set({ [key]: e.target.value })} rows={4} lang={lang} />
        ) : (
          <Input {...p} value={c[key] as string} onChange={(e) => set({ [key]: e.target.value })} className="h-10" lang={lang} />
        )
      }
    </Field>
  );

  return (
    <div className="space-y-5 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/specs" className="text-sm text-muted hover:underline">
            ← Specs & comparisons
          </Link>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{c.titleEn || "New comparison"}</h1>
        </div>
        <Button onClick={save} pending={pending}>
          {c.id ? "Save" : "Create draft"}
        </Button>
      </div>
      {error && <Alert tone="danger" title={error} />}
      {saved && !error && <Alert tone="success">Saved.</Alert>}
      {c.id && <StatusBar status={initial.status} canPublish={canPublish} pending={pending} onAction={(action) => run(() => comparisonStatusAction(c.id!, { action }))} />}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="font-semibold">Devices</h2>
          {slots.map((i) => (
            <Field key={i} label={`Device ${i + 1}${i === 2 ? " (optional)" : ""}`} error={i === 0 ? fields.specIds : undefined}>
              {(p) => (
                <Select
                  {...p}
                  value={c.specIds[i] ?? ""}
                  onChange={(e) => {
                    const next = [...c.specIds];
                    next[i] = e.target.value;
                    set({ specIds: next.slice(0, 3) });
                  }}
                  className="h-10"
                >
                  <option value="">—</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                      {o.status !== "PUBLISHED" ? ` (${o.status.toLowerCase()})` : ""}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ))}
          <p className="text-xs text-muted">Only published spec sheets appear on the public page.</p>
          <Field label="URL slug" required error={fields.slug} hint={`/en/compare/${c.slug || "…"}`}>
            {(p) => <Input {...p} value={c.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} className="h-10 font-mono text-sm" />}
          </Field>
          {text("seoTitle", "SEO title")}
          {text("metaDescription", "Meta description", true)}
        </section>
        <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
          {text("titleEn", "Title (English)")}
          {text("titleHi", "Title (Hindi)", false, "hi")}
          {text("introEn", "Introduction (English)", true)}
          {text("introHi", "Introduction (Hindi)", true, "hi")}
          {text("verdictEn", "Verdict (English)", true)}
          {text("verdictHi", "Verdict (Hindi)", true, "hi")}
        </section>
      </div>
    </div>
  );
}
