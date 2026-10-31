"use client";
import { track } from "@/components/site/analytics";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { localized } from "@/i18n/translate";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { estimatePaise } from "@/lib/customization/pricing";
import { deviceKindFor, TEXT_FONTS, TEXT_POSITIONS, FONT_FAMILIES, type DesignStyle, type TextFont, type TextPosition } from "@/lib/customization/style";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Alert, DescriptionList, Skeleton } from "@/components/ui/surface";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { DevicePicker, type PickedDevice } from "@/components/device/device-picker";
import { DevicePreview } from "@/components/customization/device-preview";

export type StudioDesign = {
  id: string;
  slug: string;
  nameEn: string;
  nameHi: string | null;
  collection: string;
  style: DesignStyle;
  basePricePaise: number | null;
};
export type StudioOption = { id: string; slug: string; nameEn: string; nameHi: string | null; descriptionEn: string | null; descriptionHi: string | null; priceDeltaPaise: number };

type TextConfig = { value: string; font: TextFont; position: TextPosition; color: string };
type Artwork = { mediaId: string | null; scale: number; x: number; y: number };

type Draft = {
  step: number;
  device: PickedDevice | null;
  designId: string | null;
  palette: string[];
  text: TextConfig | null;
  finishId: string | null;
  coverageId: string | null;
  artwork: Artwork | null;
  notes: string;
  acceptTerms: boolean;
  idempotencyKey: string;
};

const STEPS = ["device", "design", "colour", "finish", "artwork", "review"] as const;
const STORAGE_KEY = "tn_studio_draft_v1";
const CUSTOMIZABLE = ["phone", "tablet", "laptop"];
const BLANK_PALETTE = ["#1b1d2b", "#c4b5fd"];
const MAX_BYTES = 10 * 1024 * 1024;

export function Studio({
  designs,
  finishes,
  coverages,
  initialDesignSlug,
  initialSignedIn,
}: {
  designs: StudioDesign[];
  finishes: StudioOption[];
  coverages: StudioOption[];
  initialDesignSlug: string | null;
  initialSignedIn: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const fresh = (): Draft => {
    const d = designs.find((x) => x.slug === initialDesignSlug) ?? null;
    return {
      step: 0,
      device: null,
      designId: d?.id ?? null,
      palette: d ? [...d.style.palette] : [...BLANK_PALETTE],
      text: null,
      finishId: finishes[0]?.id ?? null,
      coverageId: coverages[0]?.id ?? null,
      artwork: null,
      notes: "",
      acceptTerms: false,
      idempotencyKey: crypto.randomUUID(),
    };
  };

  const [draft, setDraft] = useState<Draft>(() => ({ ...fresh(), idempotencyKey: "pending" }));
  const [hydrated, setHydrated] = useState(false);
  const [signedIn, setSignedIn] = useState(initialSignedIn);
  const [artFile, setArtFile] = useState<{ file: File; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState<null | "uploading" | "submitting">(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // One-time restore of the draft (it survives sign-in and going back).
  useEffect(() => {
    let next = fresh();
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Draft;
        next = { ...next, ...parsed };
        const wanted = designs.find((x) => x.slug === initialDesignSlug);
        if (wanted && wanted.id !== parsed.designId) next = { ...next, designId: wanted.id, palette: [...wanted.style.palette], step: parsed.device ? 2 : 0 };
        if (next.finishId && !finishes.some((f) => f.id === next.finishId)) next.finishId = finishes[0]?.id ?? null;
        if (next.coverageId && !coverages.some((c) => c.id === next.coverageId)) next.coverageId = coverages[0]?.id ?? null;
        if (next.designId && !designs.some((d) => d.id === next.designId)) next.designId = null;
      }
    } catch {
      /* storage unavailable — start fresh */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
    setDraft(next);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated || done) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft, hydrated, done]);

  useEffect(() => () => {
    if (artFile) URL.revokeObjectURL(artFile.url);
  }, [artFile]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const step = STEPS[draft.step];
  const design = designs.find((d) => d.id === draft.designId) ?? null;
  const finish = finishes.find((f) => f.id === draft.finishId) ?? null;
  const coverage = coverages.find((c) => c.id === draft.coverageId) ?? null;
  const kind = deviceKindFor(draft.device?.category.slug ?? "phone");
  const [view, setView] = useState<"back" | "front">("back");
  const style: DesignStyle = useMemo(
    () => (design ? { ...design.style, palette: draft.palette } : { pattern: "solid", palette: draft.palette, density: 5, angle: 45 }),
    [design, draft.palette],
  );
  const estimate = estimatePaise({ basePricePaise: design?.basePricePaise, finishDeltaPaise: finish?.priceDeltaPaise ?? 0, coverageDeltaPaise: coverage?.priceDeltaPaise ?? 0 });
  const artworkHref = artFile?.url ?? (draft.artwork?.mediaId ? mediaUrl(draft.artwork.mediaId) : null);
  const deviceName = draft.device ? `${draft.device.brand.name} ${draft.device.name}` : t("studio.preview.generic");

  const goTo = (n: number) => {
    setErrors({});
    setFormError(null);
    update({ step: n });
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  function validate(upTo: number): boolean {
    const errs: Record<string, string> = {};
    if (upTo >= 0 && !draft.device) errs.device = t("studio.validation.device");
    if (upTo >= 3 && (!draft.finishId || !draft.coverageId)) errs.options = t("studio.validation.options");
    if (upTo >= 2 && draft.text && (!draft.text.value.trim() || draft.text.value.length > 24)) errs.text = t("studio.validation.textTooLong");
    setErrors(errs);
    if (errs.device) goTo(0);
    return Object.keys(errs).length === 0;
  }

  async function uploadArtwork(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    form.append("purpose", "CUSTOM_ARTWORK");
    form.append("draftKey", draft.idempotencyKey.slice(0, 64));
    const res = await apiFetch<{ id: string }>("/api/v1/media", { method: "POST", body: form, locale });
    return res.id;
  }

  async function pickArtwork(file: File | undefined) {
    if (!file) return;
    setErrors({});
    if (file.size > MAX_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrors({ artwork: t("errors.upload.type") });
      return;
    }
    await removeArtwork(false);
    setArtFile({ file, url: URL.createObjectURL(file) });
    update({ artwork: { mediaId: null, scale: draft.artwork?.scale ?? 0.7, x: draft.artwork?.x ?? 0, y: draft.artwork?.y ?? 0 } });
    if (!signedIn) return;
    setUploading(true);
    try {
      const id = await uploadArtwork(file);
      setDraft((d) => (d.artwork ? { ...d, artwork: { ...d.artwork, mediaId: id } } : d));
    } catch (e) {
      if (e instanceof ApiRequestError && e.error.code === "UNAUTHENTICATED") setSignedIn(false);
      else setErrors({ artwork: e instanceof Error ? e.message : t("errors.generic") });
    } finally {
      setUploading(false);
    }
  }

  async function removeArtwork(clearDraft = true) {
    const id = draft.artwork?.mediaId;
    if (id) void apiFetch(`/api/v1/media/${id}`, { method: "DELETE", locale }).catch(() => {});
    setArtFile(null);
    if (clearDraft) update({ artwork: null });
  }

  async function submit() {
    if (!validate(5)) return;
    if (!draft.acceptTerms) return setErrors({ acceptTerms: t("studio.validation.acceptTerms") });
    setFormError(null);
    try {
      let artwork = draft.artwork;
      if (artwork && !artwork.mediaId) {
        if (!artFile) artwork = null;
        else {
          setSubmitting("uploading");
          const id = await uploadArtwork(artFile.file);
          artwork = { ...artwork, mediaId: id };
          update({ artwork });
        }
      }
      setSubmitting("submitting");
      const res = await apiFetch<{ reference: string }>("/api/v1/customization/requests", {
        method: "POST",
        locale,
        headers: { "Content-Type": "application/json", "Idempotency-Key": draft.idempotencyKey },
        body: JSON.stringify({
          deviceModelId: draft.device!.id,
          designId: draft.designId,
          finishOptionId: draft.finishId,
          coverageOptionId: draft.coverageId,
          palette: draft.palette,
          text: draft.text?.value.trim() ? { ...draft.text, value: draft.text.value.trim() } : null,
          artwork: artwork?.mediaId ? artwork : null,
          notes: draft.notes,
          acceptTerms: true,
        }),
      });
      sessionStorage.removeItem(STORAGE_KEY);
      track("design_request_submitted");
      setDone(res.reference);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setFormError(e.error.message);
        if (e.error.fields) setErrors(e.error.fields);
        if (e.error.code === "UNAUTHENTICATED") setSignedIn(false);
      } else setFormError(t("errors.generic"));
    } finally {
      setSubmitting(null);
    }
  }

  const preview = (
    <DevicePreview
      kind={kind}
      frame={draft.device?.frame}
      view={view}
      style={style}
      finish={finish?.slug}
      coverage={coverage?.slug}
      text={draft.text?.value.trim() ? draft.text : null}
      artwork={artworkHref && draft.artwork ? { href: artworkHref, ...draft.artwork } : null}
      seed={design?.slug}
      label={t("studio.preview.label", { device: deviceName })}
      className="h-full w-full drop-shadow-2xl"
    />
  );

  if (done) {
    return (
      <div className="mx-auto grid max-w-4xl items-center gap-8 px-4 py-12 md:grid-cols-2" role="status">
        <div className="mx-auto h-[380px] w-full max-w-xs">{preview}</div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-success">{t("studio.done.badge")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">{t("studio.done.title")}</h2>
          <p className="mt-3 text-muted">{t("studio.done.body", { reference: done })}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href={`/${locale}/account/designs/${done}`}>{t("studio.done.view")}</ButtonLink>
            <Button
              variant="secondary"
              onClick={() => {
                setDone(null);
                setArtFile(null);
                setDraft(fresh());
              }}
            >
              {t("studio.done.another")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!hydrated) return <Skeleton className="mx-auto my-8 h-[70vh] max-w-6xl rounded-3xl" />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-8 lg:py-10">
      {/* Canvas */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="relative flex h-[42vh] min-h-72 items-center justify-center overflow-hidden rounded-3xl border border-border bg-[radial-gradient(circle_at_50%_35%,#2a2352_0%,#0b0c14_70%)] p-6 pb-12 sm:h-[50vh] lg:h-[calc(100vh-8rem)]">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(#ffffff14_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="absolute top-3 right-3 left-3 z-10 flex items-center justify-between gap-3">
            <p className="truncate rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">{deviceName}</p>
            {kind !== "laptop" && (
              <div role="group" aria-label={t("studio.preview.side")} className="flex shrink-0 rounded-full bg-white/10 p-0.5 text-xs font-semibold backdrop-blur">
                {(["back", "front"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={cn("rounded-full px-3 py-1 transition", view === v ? "bg-white text-black" : "text-white/75 hover:text-white")}
                  >
                    {t(`studio.preview.${v}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={cn("relative h-full", kind === "laptop" ? "w-full max-w-xl" : "max-w-full")}>{preview}</div>
          <p className="absolute bottom-3 left-4 right-4 text-center text-xs text-muted">{t("studio.preview.illustrative")}</p>
        </div>
      </div>

      {/* Panel */}
      <div className="mt-5 lg:mt-0">
        <nav aria-label={t("studio.title")} className="mb-4">
          <p className="text-sm text-muted lg:hidden">{t("studio.stepOf", { current: draft.step + 1, total: STEPS.length })}</p>
          <ol className="mt-2 flex gap-1 lg:mt-0 lg:grid lg:grid-cols-3 lg:gap-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex-1">
                <button
                  type="button"
                  onClick={() => (i <= draft.step || draft.device ? goTo(i) : undefined)}
                  disabled={i > 0 && !draft.device}
                  aria-current={i === draft.step ? "step" : undefined}
                  className={cn(
                    "block h-1.5 w-full rounded-full lg:h-auto lg:rounded-xl lg:border lg:px-3 lg:py-2 lg:text-left lg:text-xs lg:font-medium",
                    i <= draft.step ? "bg-primary lg:border-primary/50 lg:bg-primary-soft" : "bg-border lg:border-border lg:bg-surface",
                    i === draft.step && "lg:ring-2 lg:ring-primary/50",
                    "disabled:cursor-not-allowed",
                  )}
                >
                  <span className="sr-only lg:not-sr-only">
                    <span className="text-muted">{i + 1}. </span>
                    {t(`studio.steps.${s}`)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="rounded-3xl border border-border bg-surface p-5">
          <h2 ref={headingRef} tabIndex={-1} className="mb-4 text-lg font-semibold outline-none">
            {t(`studio.steps.${step}`)}
          </h2>
          {formError && (
            <Alert tone="danger" className="mb-4">
              {formError}
            </Alert>
          )}

          {step === "device" && (
            <div>
              <p className="mb-3 text-sm text-muted">{t("studio.device.hint")}</p>
              <DevicePicker value={draft.device} onChange={(device) => update({ device })} categorySlugs={CUSTOMIZABLE} />
              {errors.device && (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {errors.device}
                </p>
              )}
            </div>
          )}

          {step === "design" && (
            <fieldset>
              <legend className="mb-3 text-sm text-muted">{t("studio.design.title")}</legend>
              <div className="grid max-h-[28rem] grid-cols-3 gap-2 overflow-y-auto pr-1">
                <DesignChoice
                  checked={!draft.designId}
                  onSelect={() => update({ designId: null, palette: [...BLANK_PALETTE] })}
                  name={t("studio.design.blank")}
                  style={{ pattern: "solid", palette: BLANK_PALETTE, density: 5, angle: 45 }}
                />
                {designs.map((d) => (
                  <DesignChoice key={d.id} checked={draft.designId === d.id} onSelect={() => update({ designId: d.id, palette: [...d.style.palette] })} name={localized(locale, d.nameEn, d.nameHi)} style={d.style} seed={d.slug} />
                ))}
              </div>
              {!draft.designId && <p className="mt-3 text-sm text-muted">{t("studio.design.blankBody")}</p>}
            </fieldset>
          )}

          {step === "colour" && (
            <div className="space-y-6">
              <fieldset>
                <legend className="mb-3 text-sm font-medium">{t("studio.colour.title")}</legend>
                <div className="flex flex-wrap items-center gap-3">
                  {draft.palette.map((c, i) => (
                    <label key={i} className="flex flex-col items-center gap-1 text-xs text-muted">
                      <span className="relative size-12 overflow-hidden rounded-full ring-2 ring-border has-[:focus-visible]:ring-[var(--focus)]">
                        <input
                          type="color"
                          value={c}
                          onChange={(e) => update({ palette: draft.palette.map((x, k) => (k === i ? e.target.value : x)) })}
                          className="absolute -inset-2 size-16 cursor-pointer border-0 bg-transparent p-0"
                          aria-label={t("studio.colour.swatch", { n: i + 1 })}
                        />
                      </span>
                      {i + 1}
                    </label>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => update({ palette: design ? [...design.style.palette] : [...BLANK_PALETTE] })}>
                    {t("studio.colour.reset")}
                  </Button>
                </div>
              </fieldset>

              <fieldset className="space-y-4 border-t border-border pt-5">
                <legend className="sr-only">{t("studio.colour.textTitle")}</legend>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{t("studio.colour.textTitle")}</p>
                  {draft.text ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => update({ text: null })}>
                      {t("studio.colour.removeText")}
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" size="sm" onClick={() => update({ text: { value: "", font: "sans", position: "bottom", color: "#ffffff" } })}>
                      {t("studio.colour.addText")}
                    </Button>
                  )}
                </div>
                {draft.text && (
                  <>
                    <Field label={t("studio.colour.textLabel")} hint={t("studio.colour.textHint")} error={errors.text ?? errors["text.value"]}>
                      {(p) => <Input {...p} maxLength={24} placeholder={t("studio.colour.textPlaceholder")} value={draft.text!.value} onChange={(e) => update({ text: { ...draft.text!, value: e.target.value } })} />}
                    </Field>
                    <ChipGroup
                      legend={t("studio.colour.font")}
                      options={TEXT_FONTS.map((f) => ({ value: f, label: t(`studio.colour.fonts.${f}`), style: { fontFamily: FONT_FAMILIES[f] } }))}
                      value={draft.text.font}
                      onChange={(font) => update({ text: { ...draft.text!, font } })}
                    />
                    <div className="flex flex-wrap items-end gap-6">
                      <ChipGroup
                        legend={t("studio.colour.position")}
                        options={TEXT_POSITIONS.map((p) => ({ value: p, label: t(`studio.colour.positions.${p}`) }))}
                        value={draft.text.position}
                        onChange={(position) => update({ text: { ...draft.text!, position } })}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="color" value={draft.text.color} onChange={(e) => update({ text: { ...draft.text!, color: e.target.value } })} className="size-10 cursor-pointer rounded-lg border border-border bg-transparent" />
                        {t("studio.colour.textColor")}
                      </label>
                    </div>
                  </>
                )}
              </fieldset>
            </div>
          )}

          {step === "finish" && (
            <div className="space-y-6">
              <OptionGroup legend={t("studio.finish.title")} name="finish" options={finishes} value={draft.finishId} onChange={(finishId) => update({ finishId })} />
              <OptionGroup legend={t("studio.finish.coverage")} name="coverage" options={coverages} value={draft.coverageId} onChange={(coverageId) => update({ coverageId })} />
              {errors.options && (
                <p role="alert" className="text-sm text-danger">
                  {errors.options}
                </p>
              )}
            </div>
          )}

          {step === "artwork" && (
            <div className="space-y-4">
              <p className="text-sm text-muted">{t("studio.artwork.body")}</p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]">
                  {draft.artwork ? t("studio.artwork.replace") : t("studio.artwork.choose")}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pickArtwork(e.target.files?.[0])} />
                </label>
                {draft.artwork && (
                  <Button type="button" variant="ghost" onClick={() => void removeArtwork()}>
                    {t("studio.artwork.remove")}
                  </Button>
                )}
                {uploading && <span className="text-sm text-muted">{t("studio.artwork.uploading")}</span>}
                {draft.artwork && !draft.artwork.mediaId && !uploading && artFile && <span className="text-sm text-muted">{t("studio.artwork.pendingUpload")}</span>}
              </div>
              {draft.artwork && !artworkHref && <Alert tone="warning">{t("studio.validation.artwork")}</Alert>}
              {errors.artwork && (
                <p role="alert" className="text-sm text-danger">
                  {errors.artwork}
                </p>
              )}
              {draft.artwork && (
                <div className="space-y-3">
                  <Slider label={t("studio.artwork.scale")} min={0.2} max={2} step={0.05} value={draft.artwork.scale} onChange={(scale) => update({ artwork: { ...draft.artwork!, scale } })} />
                  <Slider label={t("studio.artwork.x")} min={-1} max={1} step={0.02} value={draft.artwork.x} onChange={(x) => update({ artwork: { ...draft.artwork!, x } })} />
                  <Slider label={t("studio.artwork.y")} min={-1} max={1} step={0.02} value={draft.artwork.y} onChange={(y) => update({ artwork: { ...draft.artwork!, y } })} />
                </div>
              )}
              <p className="text-xs text-muted">{t("studio.artwork.rights")}</p>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-5">
              <DescriptionList
                items={[
                  [t("studio.review.device"), deviceName],
                  [t("studio.review.design"), design ? localized(locale, design.nameEn, design.nameHi) : t("studio.design.blank")],
                  [t("studio.review.finish"), finish ? localized(locale, finish.nameEn, finish.nameHi) : "—"],
                  [t("studio.review.coverage"), coverage ? localized(locale, coverage.nameEn, coverage.nameHi) : "—"],
                  [t("studio.review.text"), draft.text?.value.trim() || t("studio.review.none")],
                  [t("studio.review.artwork"), draft.artwork ? t("studio.review.artworkYes") : t("studio.review.none")],
                ]}
              />
              <Field label={t("studio.review.notes")}>
                {(p) => <Textarea {...p} maxLength={1000} placeholder={t("studio.review.notesPlaceholder")} value={draft.notes} onChange={(e) => update({ notes: e.target.value })} />}
              </Field>
              <Checkbox checked={draft.acceptTerms} onChange={(e) => update({ acceptTerms: e.target.checked })} aria-invalid={!!errors.acceptTerms || undefined} label={t("studio.review.acceptTerms")} />
              {errors.acceptTerms && (
                <p role="alert" className="text-sm text-danger">
                  {errors.acceptTerms}
                </p>
              )}
              {!signedIn && (
                <div className="rounded-2xl border border-primary/40 bg-primary-soft p-4">
                  <p className="mb-4 text-sm">{t("studio.review.signInNotice")}</p>
                  <SignInPanel
                    onSuccess={() => {
                      setSignedIn(true);
                      router.refresh();
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
            {draft.step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => goTo(draft.step - 1)} disabled={!!submitting}>
                {t("common.back")}
              </Button>
            ) : (
              <span />
            )}
            {step !== "review" ? (
              <Button type="button" onClick={() => validate(draft.step) && goTo(draft.step + 1)}>
                {t("common.next")}
              </Button>
            ) : (
              <Button type="button" onClick={() => void submit()} pending={!!submitting} disabled={!signedIn || uploading}>
                {submitting === "submitting" || submitting === "uploading" ? t("studio.review.submitting") : signedIn ? t("studio.review.submit") : t("studio.review.signInToSubmit")}
              </Button>
            )}
          </div>
        </div>

        {/* Price estimate */}
        <div className="mt-4 rounded-3xl border border-border bg-surface-muted p-5" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-medium">{t("studio.price.estimate")}</p>
            <p className="text-2xl font-bold tabular-nums">{formatPaise(estimate.totalPaise, locale)}</p>
          </div>
          <dl className="mt-2 space-y-1 text-sm text-muted">
            {(
              [
                ["base", estimate.basePaise],
                ["finish", estimate.finishPaise],
                ["coverage", estimate.coveragePaise],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt>{t(`studio.price.${k}`)}</dt>
                <dd className="tabular-nums">{v === 0 && k !== "base" ? t("studio.finish.included") : formatPaise(v, locale)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">{t("studio.price.estimateNote")}</p>
        </div>
      </div>
    </div>
  );
}

function DesignChoice({ checked, onSelect, name, style, seed }: { checked: boolean; onSelect: () => void; name: string; style: DesignStyle; seed?: string }) {
  return (
    <label className={cn("flex cursor-pointer flex-col items-center gap-1 rounded-2xl border p-2 text-center text-xs transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]", checked ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-muted")}>
      <input type="radio" name="design" checked={checked} onChange={onSelect} className="sr-only" />
      <span className="flex h-24 items-center">
        <DevicePreview kind="phone" style={style} finish="gloss" coverage="camera" seed={seed} label="" className="h-full" />
      </span>
      <span className="line-clamp-2 font-medium leading-tight">{name}</span>
    </label>
  );
}

function OptionGroup({ legend, name, options, value, onChange }: { legend: string; name: string; options: StudioOption[]; value: string | null; onChange: (id: string) => void }) {
  const { t, locale } = useI18n();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]",
              value === o.id ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-muted",
            )}
          >
            <input type="radio" name={name} checked={value === o.id} onChange={() => onChange(o.id)} className="mt-1 size-4 shrink-0 accent-[var(--primary)]" />
            <span className="min-w-0 flex-1">
              <span className="flex justify-between gap-2 text-sm font-medium">
                {localized(locale, o.nameEn, o.nameHi)}
                <span className="shrink-0 text-xs text-muted">{o.priceDeltaPaise ? `+${formatPaise(o.priceDeltaPaise, locale)}` : t("studio.finish.included")}</span>
              </span>
              {o.descriptionEn && <span className="mt-0.5 block text-xs text-muted">{localized(locale, o.descriptionEn, o.descriptionHi)}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ChipGroup<V extends string>({ legend, options, value, onChange }: { legend: string; options: { value: V; label: string; style?: React.CSSProperties }[]; value: V; onChange: (v: V) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            style={o.style}
            className={cn(
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]",
              value === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-surface-muted",
            )}
          >
            <input type="radio" name={legend} className="sr-only" checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-muted">{value.toFixed(2)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--primary)]" />
    </label>
  );
}
