"use client";
import { useRef, useState } from "react";
import { ApiRequestError, apiFetch } from "@/lib/api-client";
import { mediaUrl } from "@/lib/media";
import { TYPE_TRAITS } from "@/lib/schemas/shop";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Alert, Badge, Card, CardBody } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { saveProductTypeAction } from "../actions";

type Trait = (typeof TYPE_TRAITS)[number];
export type TypeRow = {
  id: string;
  categoryId: string;
  categoryName: string;
  slug: string;
  nameEn: string;
  nameHi: string;
  descriptionEn: string;
  descriptionHi: string;
  highlights: Partial<Record<Trait, number>>;
  imageMediaId: string | null;
  sortOrder: number;
  active: boolean;
  count: number;
};
type Draft = Omit<TypeRow, "id" | "categoryName" | "count">;

const TRAIT_LABELS: Record<Trait, string> = {
  clarity: "Clarity",
  privacy: "Privacy",
  antiGlare: "Anti-glare",
  toughness: "Toughness",
  protection: "Drop protection",
  grip: "Grip",
  slim: "Slimness",
  showsColour: "Shows phone colour",
};
/** Glass is compared on the first four traits, cases on the rest. */
const traitsFor = (categorySlug: string): Trait[] =>
  categorySlug.includes("case") || categorySlug.includes("cover") ? ["protection", "grip", "slim", "showsColour"] : ["clarity", "privacy", "antiGlare", "toughness"];

/** Product types (HD+, Privacy, Anti-yellow…) shoppers filter by, with comparison scores and a photo. */
export function TypesEditor({ types, categories, canEdit }: { types: TypeRow[]; categories: { id: string; slug: string; nameEn: string }[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const empty: Draft = { categoryId: categories[0]?.id ?? "", slug: "", nameEn: "", nameHi: "", descriptionEn: "", descriptionHi: "", highlights: {}, imageMediaId: null, sortOrder: 0, active: true };
  return (
    <section aria-labelledby="types-heading" className="mt-10 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="types-heading" className="text-lg font-semibold">
            Product types
          </h2>
          <p className="text-sm text-muted">Shown as filters and in the &ldquo;Which one is right for you?&rdquo; comparison. Upload a real photo for each type.</p>
        </div>
        {canEdit && editing !== "new" && (
          <Button size="sm" onClick={() => setEditing("new")}>
            New type
          </Button>
        )}
      </div>
      {editing === "new" && <TypeForm initial={empty} categories={categories} onDone={() => setEditing(null)} />}
      <ul className="grid gap-2 lg:grid-cols-2">
        {types.map((t) =>
          editing === t.id ? (
            <li key={t.id} className="lg:col-span-2">
              <TypeForm id={t.id} initial={t} categories={categories} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={t.id}>
              <Card>
                <CardBody className="flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted text-xs text-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- media API serves sized, immutable images */}
                    {t.imageMediaId ? <img src={mediaUrl(t.imageMediaId)} alt="" className="size-full object-cover" /> : "No photo"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {t.nameEn}
                      {!t.active && <Badge className="ml-2">Inactive</Badge>}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {t.categoryName} · /{t.slug} · {t.count} products
                    </p>
                  </div>
                  {canEdit && (
                    <Button size="sm" variant="secondary" onClick={() => setEditing(t.id)}>
                      Edit
                    </Button>
                  )}
                </CardBody>
              </Card>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function TypeForm({ id, initial, categories, onDone }: { id?: string; initial: Draft; categories: { id: string; slug: string; nameEn: string }[]; onDone: () => void }) {
  const { run, pending, error, fields } = useAction();
  const [v, setV] = useState<Draft>(initial);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));
  const traits = traitsFor(categories.find((c) => c.id === v.categoryId)?.slug ?? "");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("purpose", "PRODUCT_IMAGE");
      body.set("altEn", v.nameEn);
      const res = await apiFetch<{ id: string }>("/api/v1/media", { method: "POST", body });
      setV((p) => ({ ...p, imageMediaId: res.id }));
    } catch (e) {
      setUploadError(e instanceof ApiRequestError ? e.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardBody>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            // Only keep scores for traits that apply to this category.
            const highlights = Object.fromEntries(traits.filter((t) => v.highlights[t]).map((t) => [t, v.highlights[t]]));
            run(() => saveProductTypeAction(id ?? null, { ...v, highlights, sortOrder: Number(v.sortOrder) || 0 }), onDone);
          }}
        >
          {error && (
            <Alert tone="danger" className="sm:col-span-2">
              {error}
            </Alert>
          )}
          <Field label="Category" error={fields.categoryId} required>
            {(p) => (
              <Select {...p} value={v.categoryId} onChange={set("categoryId")} disabled={!!id}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Slug" hint="Used in filter links, e.g. hd-plus" error={fields.slug} required>
            {(p) => <Input {...p} value={v.slug} onChange={set("slug")} />}
          </Field>
          <Field label="Name (English)" error={fields.nameEn} required>
            {(p) => <Input {...p} value={v.nameEn} onChange={set("nameEn")} />}
          </Field>
          <Field label="Name (Hindi)" error={fields.nameHi}>
            {(p) => <Input {...p} lang="hi" value={v.nameHi} onChange={set("nameHi")} />}
          </Field>
          <Field label="Description (English)" error={fields.descriptionEn}>
            {(p) => <Input {...p} value={v.descriptionEn} onChange={set("descriptionEn")} />}
          </Field>
          <Field label="Description (Hindi)" error={fields.descriptionHi}>
            {(p) => <Input {...p} lang="hi" value={v.descriptionHi} onChange={set("descriptionHi")} />}
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-sm font-medium">Comparison scores (1–5, blank to hide)</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {traits.map((t) => (
                <label key={t} className="text-sm">
                  <span className="mb-1 block text-muted">{TRAIT_LABELS[t]}</span>
                  <Select
                    value={String(v.highlights[t] ?? "")}
                    onChange={(e) => setV((p) => ({ ...p, highlights: { ...p.highlights, [t]: e.target.value ? Number(e.target.value) : undefined } }))}
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center gap-3 sm:col-span-2">
            <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted text-xs text-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- media API serves sized, immutable images */}
              {v.imageMediaId ? <img src={mediaUrl(v.imageMediaId)} alt="" className="size-full object-cover" /> : "No photo"}
            </span>
            <div className="space-y-1">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id={`type-photo-${id ?? "new"}`} onChange={(e) => upload(e.target.files?.[0])} />
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" pending={uploading} onClick={() => fileRef.current?.click()}>
                  {v.imageMediaId ? "Replace photo" : "Upload photo"}
                </Button>
                {v.imageMediaId && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setV((p) => ({ ...p, imageMediaId: null }))}>
                    Remove
                  </Button>
                )}
              </div>
              {(uploadError || fields.imageMediaId) && <p className="text-sm text-danger">{uploadError ?? fields.imageMediaId}</p>}
            </div>
          </div>
          <Field label="Sort order" error={fields.sortOrder}>
            {(p) => <Input {...p} type="number" value={String(v.sortOrder)} onChange={set("sortOrder")} />}
          </Field>
          <Checkbox label="Active (visible in store)" checked={v.active} onChange={(e) => setV((p) => ({ ...p, active: e.target.checked }))} className="self-end" />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" size="sm" pending={pending}>
              Save type
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
