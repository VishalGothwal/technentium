"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { readingMinutes } from "@/lib/content/reading";
import { CONTENT_TOPICS, type ContentBlock } from "@/lib/schemas/content";
import { createContentAction, publishContentAction, restoreRevisionAction, updateContentAction } from "@/app/admin/(console)/content/actions";
import { BlockEditor, stripKeys, withKeys, type EditorBlock } from "./block-editor";
import { ImageUpload } from "./media-upload";
import { RelationPicker, type RelationOption } from "./relation-picker";

type Locale = "en" | "hi";
type Status = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type EditorTranslation = {
  title: string;
  summary: string;
  body: ContentBlock[];
  seoTitle: string | null;
  metaDescription: string | null;
  status: Status;
  scheduledAt: string | null;
  publishedAt: string | null;
  revisions: { id: string; createdAt: string; authorName: string }[];
};
export type EditorInitial = {
  id?: string;
  type: "ARTICLE" | "VIDEO";
  slug: string;
  topic: string;
  tags: string[];
  coverMediaId: string | null;
  videoUrl: string | null;
  featured: boolean;
  updatedAt?: string;
  translations: Partial<Record<Locale, EditorTranslation>>;
  relations: RelationOption[];
  /** Labels for targets referenced in related blocks. */
  blockLabels: RelationOption[];
};

type Draft = { title: string; summary: string; blocks: EditorBlock[]; seoTitle: string; metaDescription: string };

const TOPIC_LABELS: Record<string, string> = { "repair-guides": "Repair guides", "buying-guides": "Buying guides", protection: "Protection", tips: "Tips & care", news: "News", "software-apps": "Software & apps", photography: "Photography", gaming: "Gaming", "laptops-tablets": "Laptops & tablets", accessories: "Accessories" };
const STATUS_TONE: Record<Status, "neutral" | "info" | "success" | "warning"> = { DRAFT: "neutral", SCHEDULED: "info", PUBLISHED: "success", ARCHIVED: "warning" };

const toDraft = (t: EditorTranslation | undefined, labels: RelationOption[]): Draft => ({
  title: t?.title ?? "",
  summary: t?.summary ?? "",
  blocks: withKeys(t?.body ?? [], labels),
  seoTitle: t?.seoTitle ?? "",
  metaDescription: t?.metaDescription ?? "",
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

/**
 * CMS editor (FR-CMS-02..10): shared item settings, independent EN/HI translations with their own
 * publication state, SEO fields with a search-result preview, relations and revision history.
 */
export function ContentEditor({ initial, canPublish }: { initial: EditorInitial; canPublish: boolean }) {
  const router = useRouter();
  const isNew = !initial.id;
  const { run, pending, error, fields } = useAction();
  const [locale, setLocale] = useState<Locale>("en");
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [topic, setTopic] = useState(initial.topic);
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [cover, setCover] = useState(initial.coverMediaId);
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl ?? "");
  const [featured, setFeatured] = useState(initial.featured);
  const [relations, setRelations] = useState(initial.relations);
  const [drafts, setDrafts] = useState<Record<Locale, Draft>>({
    en: toDraft(initial.translations.en, initial.blockLabels),
    hi: toDraft(initial.translations.hi, initial.blockLabels),
  });
  const [dirty, setDirty] = useState<Record<Locale, boolean>>({ en: false, hi: false });
  const [scheduleAt, setScheduleAt] = useState("");
  const [saved, setSaved] = useState(false);

  const d = drafts[locale];
  const tr = initial.translations[locale];
  const setD = (patch: Partial<Draft>) => {
    setDrafts((all) => ({ ...all, [locale]: { ...all[locale], ...patch } }));
    setDirty((x) => ({ ...x, [locale]: true }));
    setSaved(false);
    if (isNew && locale === "en" && patch.title !== undefined && !slugTouched) setSlug(slugify(patch.title));
  };
  const anyDirty = dirty.en || dirty.hi;

  const translationPayload = (l: Locale) => {
    const x = drafts[l];
    return { title: x.title, summary: x.summary, body: stripKeys(x.blocks), seoTitle: x.seoTitle || undefined, metaDescription: x.metaDescription || undefined };
  };
  const itemPayload = () => ({
    slug,
    topic,
    tags: tags
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    coverMediaId: cover,
    videoUrl: videoUrl.trim() || null,
    featured,
  });

  function save() {
    if (isNew) {
      run(
        () => createContentAction({ type: initial.type, ...itemPayload(), locale, translation: translationPayload(locale) }),
        (res) => router.replace(`/admin/content/${(res as { id: string }).id}`),
      );
      return;
    }
    const translations: Partial<Record<Locale, ReturnType<typeof translationPayload>>> = {};
    for (const l of ["en", "hi"] as const) if (dirty[l] && (drafts[l].title.trim() || initial.translations[l])) translations[l] = translationPayload(l);
    run(
      () =>
        updateContentAction(initial.id!, {
          item: itemPayload(),
          translations,
          relations: relations.map(({ targetType, targetId }) => ({ targetType, targetId })),
          expectedUpdatedAt: initial.updatedAt,
        }),
      () => {
        setDirty({ en: false, hi: false });
        setSaved(true);
      },
    );
  }

  function publish(action: "publish" | "schedule" | "unpublish" | "archive") {
    if (!initial.id) return;
    if (anyDirty && action !== "unpublish" && action !== "archive") {
      // Save first so what gets published is what the editor sees.
      const translations: Partial<Record<Locale, ReturnType<typeof translationPayload>>> = {};
      for (const l of ["en", "hi"] as const) if (dirty[l]) translations[l] = translationPayload(l);
      run(async () => {
        const r = await updateContentAction(initial.id!, { item: itemPayload(), translations, relations: relations.map(({ targetType, targetId }) => ({ targetType, targetId })), expectedUpdatedAt: initial.updatedAt });
        if (!r.ok) return r;
        return publishContentAction(initial.id!, { locale, action, scheduledAt: action === "schedule" ? new Date(scheduleAt).toISOString() : undefined });
      }, () => setDirty({ en: false, hi: false }));
      return;
    }
    run(() => publishContentAction(initial.id!, { locale, action, scheduledAt: action === "schedule" && scheduleAt ? new Date(scheduleAt).toISOString() : undefined }));
  }

  // Validation messages: create uses `translation.*`, update uses `translations.<locale>.*` and `item.*`.
  const fe = (key: string) =>
    fields[key] ?? fields[`item.${key}`] ?? fields[`translation.${key}`] ?? fields[`translations.${locale}.${key}`] ?? undefined;
  const blockErrors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (k.startsWith("translation.body.")) out[k.replace("translation.", "")] = v;
      if (k.startsWith(`translations.${locale}.body.`)) out[k.replace(`translations.${locale}.`, "")] = v;
    }
    return out;
  }, [fields, locale]);

  const minutes = readingMinutes(stripKeys(d.blocks));
  const seoTitle = d.seoTitle || d.title;
  const seoDesc = d.metaDescription || d.summary;
  const path = `/${locale}/${initial.type === "VIDEO" ? "videos" : "articles"}/${slug || "…"}`;

  return (
    <div className="pb-24">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/content" className="text-sm text-muted hover:underline">
            ← All content
          </Link>
          <h1 className="mt-1 truncate text-xl font-semibold sm:text-2xl">{isNew ? `New ${initial.type === "VIDEO" ? "video" : "article"}` : drafts.en.title || drafts.hi.title || slug}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && initial.translations[locale] && (
            <Link href={`/admin/content/${initial.id}/preview?locale=${locale}`} target="_blank" className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-muted">
              Preview {locale.toUpperCase()} ↗
            </Link>
          )}
          <Button onClick={save} pending={pending}>
            {isNew ? "Create draft" : "Save changes"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert tone="danger" className="mb-4" title={error}>
          {Object.keys(fields).length > 0 && (
            <ul className="list-disc pl-5">
              {Object.entries(fields)
                .slice(0, 6)
                .map(([k, v]) => (
                  <li key={k}>
                    <code className="text-xs">{k}</code>: {v}
                  </li>
                ))}
            </ul>
          )}
        </Alert>
      )}
      {saved && !error && (
        <Alert tone="success" className="mb-4">
          Saved.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <div role="tablist" aria-label="Language" className="flex gap-1 rounded-xl bg-surface-muted p-1">
            {(["en", "hi"] as const).map((l) => {
              const t = initial.translations[l];
              return (
                <button
                  key={l}
                  role="tab"
                  type="button"
                  aria-selected={locale === l}
                  onClick={() => setLocale(l)}
                  className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", locale === l ? "bg-surface shadow-sm" : "text-muted hover:text-foreground")}
                >
                  {l === "en" ? "English" : "हिन्दी (Hindi)"}
                  {t ? <Badge tone={STATUS_TONE[t.status]}>{t.status.toLowerCase()}</Badge> : <Badge>not started</Badge>}
                  {dirty[l] && <span className="size-2 rounded-full bg-warning" aria-label="unsaved changes" />}
                </button>
              );
            })}
          </div>
          {isNew && locale === "hi" && <Alert tone="info">New content starts with one language. Create the draft, then add the other translation.</Alert>}

          <div className="space-y-4 rounded-xl border border-border bg-surface p-4" lang={locale}>
            <Field label="Title" required error={fe("title")}>
              {(p) => <Input {...p} value={d.title} onChange={(e) => setD({ title: e.target.value })} className="text-lg font-semibold" maxLength={160} />}
            </Field>
            <Field label="Summary" hint="Shown on cards and under the title. 1–2 sentences." required error={fe("summary")}>
              {(p) => <Textarea {...p} value={d.summary} onChange={(e) => setD({ summary: e.target.value })} rows={2} maxLength={400} />}
            </Field>
          </div>

          <section aria-labelledby="body-title">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="body-title" className="font-semibold">
                Body
              </h2>
              <span className="text-xs text-muted">~{minutes} min read</span>
            </div>
            <BlockEditor blocks={d.blocks} onChange={(blocks) => setD({ blocks })} errors={blockErrors} />
          </section>

          <section aria-labelledby="seo-title" className="space-y-4 rounded-xl border border-border bg-surface p-4">
            <h2 id="seo-title" className="font-semibold">
              Search engine listing
            </h2>
            <Field label={<Counter label="SEO title" n={d.seoTitle.length} max={60} />} hint="Defaults to the title. Aim for 50–60 characters." error={fe("seoTitle")}>
              {(p) => <Input {...p} value={d.seoTitle} onChange={(e) => setD({ seoTitle: e.target.value })} maxLength={70} />}
            </Field>
            <Field label={<Counter label="Meta description" n={d.metaDescription.length} max={155} />} hint="Defaults to the summary. Aim for 120–155 characters." error={fe("metaDescription")}>
              {(p) => <Textarea {...p} value={d.metaDescription} onChange={(e) => setD({ metaDescription: e.target.value })} rows={2} maxLength={170} />}
            </Field>
            <div className="rounded-lg border border-border bg-background p-4" aria-label="Search result preview">
              <p className="truncate text-xs text-muted">
                technentium.in
                {path}
              </p>
              <p className="mt-0.5 line-clamp-1 text-lg text-[#1a0dab]">{seoTitle ? `${seoTitle} · Technentium` : "Title"}</p>
              <p className="line-clamp-2 text-sm text-muted">{seoDesc || "Description"}</p>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          {!isNew && (
            <section className="space-y-3 rounded-xl border border-border bg-surface p-4" aria-labelledby="pub-title">
              <h2 id="pub-title" className="font-semibold">
                Publishing · {locale === "en" ? "English" : "Hindi"}
              </h2>
              {tr ? (
                <>
                  <p className="text-sm">
                    Status: <Badge tone={STATUS_TONE[tr.status]}>{tr.status.toLowerCase()}</Badge>
                  </p>
                  {tr.status === "SCHEDULED" && tr.scheduledAt && <p className="text-sm text-muted">Goes live {formatDateTime(tr.scheduledAt)}</p>}
                  {tr.publishedAt && tr.status === "PUBLISHED" && <p className="text-sm text-muted">Published {formatDateTime(tr.publishedAt)}</p>}
                  {canPublish ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {tr.status !== "PUBLISHED" && (
                          <Button size="sm" onClick={() => publish("publish")} pending={pending}>
                            Publish now
                          </Button>
                        )}
                        {(tr.status === "PUBLISHED" || tr.status === "SCHEDULED") && (
                          <Button size="sm" variant="secondary" onClick={() => publish("unpublish")} pending={pending}>
                            Unpublish
                          </Button>
                        )}
                        {tr.status !== "ARCHIVED" && (
                          <Button size="sm" variant="ghost" onClick={() => publish("archive")} pending={pending}>
                            Archive
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <Input type="datetime-local" aria-label="Schedule date and time" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="h-9 text-sm" />
                        <Button size="sm" variant="secondary" disabled={!scheduleAt} onClick={() => publish("schedule")} pending={pending}>
                          Schedule
                        </Button>
                      </div>
                      {anyDirty && <p className="text-xs text-muted">Unsaved changes are saved before publishing.</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">You can edit drafts. Ask an editor with publishing rights to publish.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">No {locale === "en" ? "English" : "Hindi"} version yet. Write it and save — the other language stays as it is (FR-CMS-04).</p>
              )}
            </section>
          )}

          <section className="space-y-3 rounded-xl border border-border bg-surface p-4" aria-labelledby="settings-title">
            <h2 id="settings-title" className="font-semibold">
              Settings
            </h2>
            <Field label="URL slug" hint={`Shared by both languages: ${path}`} required error={fe("slug")}>
              {(p) => (
                <Input
                  {...p}
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase());
                    setSlugTouched(true);
                  }}
                  className="h-10 font-mono text-sm"
                />
              )}
            </Field>
            <Field label="Topic" required error={fe("topic")}>
              {(p) => (
                <Select {...p} value={topic} onChange={(e) => setTopic(e.target.value)} className="h-10">
                  {CONTENT_TOPICS.map((tp) => (
                    <option key={tp} value={tp}>
                      {TOPIC_LABELS[tp]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Tags" hint="Comma-separated, e.g. battery, iphone. Used for related content." error={fe("tags")}>
              {(p) => <Input {...p} value={tags} onChange={(e) => setTags(e.target.value)} className="h-10" />}
            </Field>
            {initial.type === "VIDEO" && (
              <Field label="Video URL" required hint="YouTube or Vimeo link" error={fe("videoUrl")}>
                {(p) => <Input {...p} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="h-10" />}
              </Field>
            )}
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Cover image</p>
              <ImageUpload value={cover} onChange={setCover} label="Cover image" />
              <p className="text-xs text-muted">Optional — a generated cover is used when empty.</p>
            </div>
            <Checkbox label="Featured on the listing page" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          </section>

          {!isNew && (
            <section className="space-y-3 rounded-xl border border-border bg-surface p-4" aria-labelledby="rel-title">
              <h2 id="rel-title" className="font-semibold">
                Related content
              </h2>
              <p className="text-xs text-muted">Shown at the end of the article. Articles with the same topic or tags are suggested automatically too.</p>
              <RelationPicker value={relations} onChange={setRelations} excludeId={initial.id} />
              {fe("relations") && <p className="text-sm text-danger">{fe("relations")}</p>}
            </section>
          )}

          {!isNew && tr && tr.revisions.length > 0 && (
            <section className="space-y-2 rounded-xl border border-border bg-surface p-4" aria-labelledby="rev-title">
              <h2 id="rev-title" className="font-semibold">
                Revisions · {locale.toUpperCase()}
              </h2>
              <ol className="max-h-64 space-y-1 overflow-auto text-sm">
                {tr.revisions.map((r, i) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-surface-muted">
                    <span>
                      {formatDateTime(r.createdAt)}
                      <span className="block text-xs text-muted">
                        {r.authorName}
                        {i === 0 && " · current"}
                      </span>
                    </span>
                    {i > 0 && (
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => {
                          if (window.confirm("Restore this revision? The current text is kept in the history.")) run(() => restoreRevisionAction(r.id), () => window.location.reload());
                        }}
                      >
                        Restore
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Counter({ label, n, max }: { label: string; n: number; max: number }) {
  return (
    <span className="flex w-full items-center justify-between gap-2">
      {label}
      <span className={cn("text-xs font-normal", n > max ? "text-danger" : "text-muted")}>
        {n}/{max}
      </span>
    </span>
  );
}
