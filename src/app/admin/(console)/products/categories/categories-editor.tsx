"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Alert, Badge, Card, CardBody } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { saveCategoryAction } from "../actions";

type Category = { id: string; slug: string; nameEn: string; nameHi: string; descriptionEn: string; descriptionHi: string; sortOrder: number; active: boolean; count: number };
const EMPTY: Omit<Category, "id" | "count"> = { slug: "", nameEn: "", nameHi: "", descriptionEn: "", descriptionHi: "", sortOrder: 0, active: true };

export function CategoriesEditor({ categories, canEdit }: { categories: Category[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  return (
    <div className="space-y-3">
      {canEdit && editing !== "new" && (
        <Button size="sm" onClick={() => setEditing("new")}>
          New category
        </Button>
      )}
      {editing === "new" && <CategoryForm initial={EMPTY} onDone={() => setEditing(null)} />}
      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.id}>
            {editing === c.id ? (
              <CategoryForm id={c.id} initial={c} onDone={() => setEditing(null)} />
            ) : (
              <Card>
                <CardBody className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {c.nameEn} {c.nameHi && <span className="text-muted">· {c.nameHi}</span>}
                      {!c.active && <Badge className="ml-2">Inactive</Badge>}
                    </p>
                    <p className="text-sm text-muted">
                      /{c.slug} · {c.count} products · order {c.sortOrder}
                    </p>
                  </div>
                  {canEdit && (
                    <Button size="sm" variant="secondary" onClick={() => setEditing(c.id)}>
                      Edit
                    </Button>
                  )}
                </CardBody>
              </Card>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryForm({ id, initial, onDone }: { id?: string; initial: Omit<Category, "id" | "count">; onDone: () => void }) {
  const { run, pending, error, fields } = useAction();
  const [v, setV] = useState(initial);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Card>
      <CardBody>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveCategoryAction(id ?? null, { ...v, sortOrder: Number(v.sortOrder) || 0 }), onDone);
          }}
        >
          {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
          <Field label="Name (English)" error={fields.nameEn} required>
            {(p) => <Input {...p} value={v.nameEn} onChange={set("nameEn")} />}
          </Field>
          <Field label="Name (Hindi)" error={fields.nameHi}>
            {(p) => <Input {...p} lang="hi" value={v.nameHi} onChange={set("nameHi")} />}
          </Field>
          <Field label="Slug" error={fields.slug} required>
            {(p) => <Input {...p} value={v.slug} onChange={set("slug")} />}
          </Field>
          <Field label="Sort order" error={fields.sortOrder}>
            {(p) => <Input {...p} type="number" value={String(v.sortOrder)} onChange={set("sortOrder")} />}
          </Field>
          <Field label="Description (English)" error={fields.descriptionEn}>
            {(p) => <Input {...p} value={v.descriptionEn} onChange={set("descriptionEn")} />}
          </Field>
          <Field label="Description (Hindi)" error={fields.descriptionHi}>
            {(p) => <Input {...p} lang="hi" value={v.descriptionHi} onChange={set("descriptionHi")} />}
          </Field>
          <Checkbox label="Active (visible in store)" checked={v.active} onChange={(e) => setV((p) => ({ ...p, active: e.target.checked }))} />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" size="sm" pending={pending}>
              Save
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
