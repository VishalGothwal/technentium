"use client";
import { track } from "@/components/site/analytics";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { formatDate, formatPaise } from "@/lib/format";
import { cn } from "@/lib/cn";
import { OTHER_MODEL_NAME } from "@/lib/device-name";
import { formatNational, isCompleteNational, isValidPincode, nationalDigits, normalizeIndianMobile } from "@/lib/phone";
import { HANDOVER_METHODS, METHODS_NEEDING_ADDRESS, type HandoverMethodKey } from "@/lib/schemas/repair";
import { useI18n } from "@/i18n/client";
import { localized } from "@/i18n/translate";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Alert, Card, DescriptionList, Skeleton } from "@/components/ui/surface";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { PhoneInput } from "@/components/ui/phone-input";

type Category = { id: string; nameEn: string; nameHi: string | null };
type Named = { id: string; name: string };
type ModelOption = Named & { releaseYear: number | null; popular: boolean };
type Issue = { id: string; nameEn: string; nameHi: string | null; descriptionEn: string | null; descriptionHi: string | null };
type Slot = { id: string; date: string; startTime: string; endTime: string; remaining: number };
type Fee = { feePaise: number; waivedIfApproved: boolean } | null;

type Draft = {
  step: number;
  categoryId?: string;
  brandId?: string;
  modelId?: string;
  modelName?: string;
  issueTypeIds: string[];
  description: string;
  handoverMethod?: HandoverMethodKey;
  contactName: string;
  contactPhone: string;
  address: { addressLine1: string; addressLine2: string; landmark: string; pincode: string };
  handoverNotes: string;
  slotId?: string;
  acceptPolicy: boolean;
  idempotencyKey: string;
};

const STEPS = ["device", "issues", "details", "handover", "location", "slot", "review"] as const;
const STORAGE_KEY = "tn_booking_draft_v1";
const MAX_PHOTOS = 6;

type Address = Draft["address"];
const EMPTY_ADDRESS: Address = { addressLine1: "", addressLine2: "", landmark: "", pincode: "" };

const newDraft = (defaults: { contactName: string; contactPhone: string; address?: Address | null }): Draft => ({
  step: 0,
  issueTypeIds: [],
  description: "",
  contactName: defaults.contactName,
  contactPhone: defaults.contactPhone,
  address: defaults.address ?? EMPTY_ADDRESS,
  handoverNotes: "",
  acceptPolicy: false,
  idempotencyKey: crypto.randomUUID(),
});

/** Fetch `path` (null = idle). State is keyed by path so a new path reads as loading without a synchronous reset. */
function useFetch<T>(path: string | null, locale: string) {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string | null }>({ path: null, data: null, error: null });
  useEffect(() => {
    if (!path) return;
    let live = true;
    apiFetch<T>(path, { locale })
      .then((data) => live && setState({ path, data, error: null }))
      .catch((e: unknown) => live && setState({ path, data: null, error: e instanceof Error ? e.message : "error" }));
    return () => {
      live = false;
    };
  }, [path, locale]);
  if (!path) return { data: null, loading: false, error: null };
  return state.path === path ? { data: state.data, loading: false, error: state.error } : { data: null, loading: true, error: null };
}

export type BookingPrefill = Pick<Draft, "categoryId" | "brandId" | "modelId" | "modelName" | "issueTypeIds" | "description">;

export function BookingWizard({
  initialSignedIn,
  defaults,
  prefill,
}: {
  initialSignedIn: boolean;
  /** Account and last-booking details, so returning customers don't retype them. */
  defaults: { contactName: string; contactPhone: string; address: Address | null; hasEmail: boolean };
  /** Device and services chosen on a repair model page — starts a fresh draft at the details step. */
  prefill?: BookingPrefill | null;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => newDraft(defaults));
  const [hydrated, setHydrated] = useState(false);
  const [signedIn, setSignedIn] = useState(initialSignedIn);
  const [editingContact, setEditingContact] = useState(false);
  const [photos, setPhotos] = useState<{ file: File; url: string; uploadedId?: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<null | "uploading" | "submitting">(null);
  const [done, setDone] = useState<string | null>(null);
  const [pincodeState, setPincodeState] = useState<{ pincode: string; serviceable: boolean; locality?: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Restore an in-progress draft (survives refresh and the sign-in step; PRD §5.1 "preserve form state").
  // sessionStorage only exists in the browser, so this must run after hydration rather than in the initial state.
  useEffect(() => {
    if (prefill) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time start from the model page selection
      setDraft({ ...newDraft(defaults), ...prefill, step: STEPS.indexOf("details") });
      setHydrated(true);
      // Drop the query so a reload resumes the saved draft instead of starting over.
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Draft;
        setDraft({
          ...parsed,
          contactName: parsed.contactName || defaults.contactName,
          contactPhone: parsed.contactPhone || defaults.contactPhone,
          address: parsed.address?.addressLine1 ? parsed.address : (defaults.address ?? parsed.address ?? EMPTY_ADDRESS),
        });
      }
    } catch {
      /* storage unavailable — start fresh */
    }
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

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const goTo = (step: number) => {
    setErrors({});
    setFormError(null);
    update({ step });
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const categories = useFetch<Category[]>("/api/v1/devices/categories", locale);
  const brands = useFetch<Named[]>(draft.categoryId ? `/api/v1/devices/brands?categoryId=${draft.categoryId}` : null, locale);
  const models = useFetch<ModelOption[]>(draft.brandId ? `/api/v1/devices/models?brandId=${draft.brandId}` : null, locale);
  const issues = useFetch<Issue[]>(draft.categoryId ? `/api/v1/repair/issues?categoryId=${draft.categoryId}` : null, locale);
  const slots = useFetch<Slot[]>(draft.step >= 5 ? "/api/v1/appointment-slots" : null, locale);
  const fee = useFetch<Fee>(
    draft.step === 6 && draft.modelId && draft.issueTypeIds.length ? `/api/v1/repair/diagnosis-fee?modelId=${draft.modelId}&issueTypeIds=${draft.issueTypeIds.join(",")}` : null,
    locale,
  );

  const needsAddress = !!draft.handoverMethod && METHODS_NEEDING_ADDRESS.includes(draft.handoverMethod);
  // "Other model" catalogue entries (see prisma/seed.ts addOtherOptions): the customer types the real device.
  const isOtherModel = draft.modelName === OTHER_MODEL_NAME;
  const step = STEPS[draft.step];

  async function checkPincode(pincode: string) {
    if (!isValidPincode(pincode)) {
      setErrors((e) => ({ ...e, pincode: t("validation.pincode") }));
      return null;
    }
    try {
      const res = await apiFetch<{ serviceable: boolean; locality?: string }>(`/api/v1/serviceability?pincode=${pincode}`, { locale });
      setPincodeState({ pincode, ...res });
      return res.serviceable;
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("errors.generic"));
      return null;
    }
  }

  async function validateAndNext() {
    const errs: Record<string, string> = {};
    if (step === "device" && !draft.modelId) errs.modelId = t("validation.required");
    if (step === "issues" && draft.issueTypeIds.length === 0) errs.issueTypeIds = t("validation.issues");
    if (step === "details" && isOtherModel && draft.description.trim().length < 3) errs.description = t("booking.otherModelRequired");
    if (step === "handover" && !draft.handoverMethod) errs.handoverMethod = t("validation.required");
    if (step === "location") {
      if (draft.contactName.trim().length < 2) errs.contactName = t("validation.name");
      if (!normalizeIndianMobile(draft.contactPhone)) errs.contactPhone = t("validation.phone");
      if (needsAddress) {
        if (draft.address.addressLine1.trim().length < 5) errs.addressLine1 = t("validation.address");
        if (!isValidPincode(draft.address.pincode)) errs.pincode = t("validation.pincode");
      }
    }
    if (step === "slot" && !draft.slotId) errs.slotId = t("validation.slot");
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (step === "location" && needsAddress) {
      const ok = pincodeState?.pincode === draft.address.pincode ? pincodeState.serviceable : await checkPincode(draft.address.pincode);
      if (!ok) return;
    }
    goTo(draft.step + 1);
  }

  async function submit() {
    if (!draft.acceptPolicy) return setErrors({ acceptPolicy: t("validation.acceptPolicy") });
    setFormError(null);
    try {
      setSubmitting("uploading");
      const uploaded = [...photos];
      for (let i = 0; i < uploaded.length; i++) {
        if (uploaded[i].uploadedId) continue;
        const form = new FormData();
        form.append("file", uploaded[i].file);
        const res = await apiFetch<{ id: string }>("/api/v1/uploads/booking-photos", { method: "POST", body: form, locale });
        uploaded[i] = { ...uploaded[i], uploadedId: res.id };
        setPhotos([...uploaded]);
      }

      setSubmitting("submitting");
      const res = await apiFetch<{ reference: string }>("/api/v1/repair/bookings", {
        method: "POST",
        locale,
        headers: { "Content-Type": "application/json", "Idempotency-Key": draft.idempotencyKey },
        body: JSON.stringify({
          modelId: draft.modelId,
          issueTypeIds: draft.issueTypeIds,
          description: draft.description,
          attachmentIds: uploaded.map((p) => p.uploadedId),
          handoverMethod: draft.handoverMethod,
          address: needsAddress ? draft.address : undefined,
          slotId: draft.slotId,
          contactName: draft.contactName,
          contactPhone: draft.contactPhone,
          handoverNotes: draft.handoverNotes,
          acceptPolicy: true,
        }),
      });
      sessionStorage.removeItem(STORAGE_KEY);
      track("repair_booking_submitted", { handover_method: draft.handoverMethod ?? undefined });
      setDone(res.reference);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setFormError(e.error.message);
        if (e.error.fields) setErrors(e.error.fields);
        if (e.error.code === "UNAUTHENTICATED") setSignedIn(false);
        if (e.error.code === "SLOT_FULL" || e.error.fields?.slotId) goTo(5);
        if (e.error.code === "UNSERVICEABLE") goTo(4);
      } else setFormError(t("errors.generic"));
    } finally {
      setSubmitting(null);
    }
  }

  if (done) {
    return (
      <Card className="mt-6 p-6 text-center" role="status">
        <p className="text-sm font-medium text-success">{t("booking.pending")}</p>
        <h2 className="mt-2 text-xl font-semibold">{t("booking.successTitle")}</h2>
        <p className="mt-2 text-muted">{t("booking.successBody", { reference: done })}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href={`/${locale}/account/bookings/${done}`}>{t("booking.viewBooking")}</ButtonLink>
          <Button variant="secondary" onClick={() => { setDone(null); setPhotos([]); setDraft(newDraft(defaults)); }}>
            {t("booking.bookAnother")}
          </Button>
        </div>
      </Card>
    );
  }

  if (!hydrated) return <Skeleton className="mt-6 h-64" />;

  if (!signedIn) {
    return (
      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{t("booking.signInFirstTitle")}</h2>
        <p className="mt-1 mb-5 text-sm text-muted">{t("booking.signInFirstBody")}</p>
        <SignInPanel
          autoFocus
          onSuccess={() => {
            setSignedIn(true);
            // Re-render with the account's saved name, phone and address (the page remounts the wizard).
            router.refresh();
          }}
        />
      </Card>
    );
  }

  const selectedCategory = categories.data?.find((c) => c.id === draft.categoryId);
  const selectedIssues = issues.data?.filter((i) => draft.issueTypeIds.includes(i.id)) ?? [];
  const selectedSlot = slots.data?.find((s) => s.id === draft.slotId);

  return (
    <div className="mt-6">
      {/* Progress */}
      <div className="mb-4">
        <p className="text-sm text-muted">{t("booking.stepOf", { current: draft.step + 1, total: STEPS.length })}</p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= draft.step ? "bg-primary" : "bg-border")} />
          ))}
        </div>
      </div>

      <Card className="p-5">
        <h2 ref={headingRef} tabIndex={-1} className="mb-4 text-lg font-semibold outline-none">
          {t(`booking.steps.${step}`)}
        </h2>

        {formError && (
          <Alert tone="danger" className="mb-4">
            {formError}
          </Alert>
        )}

        {step === "device" && (
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t("booking.category")}</legend>
              {categories.loading ? (
                <Skeleton className="h-12" />
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {categories.data?.map((c) => (
                    <ChoiceCard
                      key={c.id}
                      name="category"
                      checked={draft.categoryId === c.id}
                      onChange={() => update({ categoryId: c.id, brandId: undefined, modelId: undefined, modelName: undefined, issueTypeIds: [] })}
                      title={localized(locale, c.nameEn, c.nameHi)}
                    />
                  ))}
                </div>
              )}
            </fieldset>
            {draft.categoryId && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t("booking.brand")}</legend>
                {brands.loading ? (
                  <Skeleton className="h-12" />
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {brands.data?.map((b) => (
                      <ChoiceCard key={b.id} name="brand" checked={draft.brandId === b.id} onChange={() => update({ brandId: b.id, modelId: undefined, modelName: undefined })} title={b.name} compact />
                    ))}
                  </div>
                )}
              </fieldset>
            )}
            {draft.brandId && <ModelPicker models={models.data} loading={models.loading} value={draft.modelId} error={errors.modelId} onSelect={(m) => update({ modelId: m.id, modelName: m.name })} />}
          </div>
        )}

        {step === "issues" && (
          <fieldset aria-describedby={errors.issueTypeIds ? "issues-error" : undefined}>
            <legend className="mb-1 text-sm font-medium">{t("booking.issuesTitle", { model: draft.modelName ?? "" })}</legend>
            <p className="mb-3 text-sm text-muted">{t("booking.issuesHint")}</p>
            {issues.loading ? (
              <Skeleton className="h-40" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {issues.data?.map((i) => (
                  <ChoiceCard
                    key={i.id}
                    type="checkbox"
                    name="issues"
                    checked={draft.issueTypeIds.includes(i.id)}
                    onChange={(checked) => update({ issueTypeIds: checked ? [...draft.issueTypeIds, i.id] : draft.issueTypeIds.filter((x) => x !== i.id) })}
                    title={localized(locale, i.nameEn, i.nameHi)}
                    description={i.descriptionEn ? localized(locale, i.descriptionEn, i.descriptionHi) : undefined}
                  />
                ))}
              </div>
            )}
            {errors.issueTypeIds && (
              <p id="issues-error" role="alert" className="mt-2 text-sm text-danger">
                {errors.issueTypeIds}
              </p>
            )}
          </fieldset>
        )}

        {step === "details" && (
          <div className="space-y-5">
            <Field
              label={isOtherModel ? t("booking.otherModelLabel") : t("booking.descriptionLabel")}
              hint={isOtherModel ? t("booking.otherModelHint") : t("booking.descriptionHint")}
              error={errors.description}
            >
              {(p) => <Textarea {...p} value={draft.description} maxLength={2000} onChange={(e) => update({ description: e.target.value })} />}
            </Field>
            <div>
              <p className="text-sm font-medium">
                {t("booking.photosLabel")} <span className="font-normal text-muted">({t("common.optional")})</span>
              </p>
              <p className="mb-3 text-xs text-muted">{t("booking.photosHint")}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {photos.map((p, i) => (
                  <div key={p.url} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={t("booking.photoAlt", { index: i + 1 })} className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos(photos.filter((x) => x !== p))}
                      className="absolute right-1 top-1 rounded-full bg-foreground/80 px-2 py-0.5 text-xs text-white"
                      aria-label={`${t("common.remove")} ${i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {photos.length < MAX_PHOTOS && (
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm hover:bg-surface-muted">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      const tooBig = files.some((f) => f.size > 10 * 1024 * 1024);
                      if (tooBig) setFormError(t("errors.upload.tooLarge"));
                      const ok = files.filter((f) => f.size <= 10 * 1024 * 1024).slice(0, MAX_PHOTOS - photos.length);
                      setPhotos([...photos, ...ok.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
                      e.target.value = "";
                    }}
                  />
                  {t("booking.addPhotos")}
                </label>
              )}
            </div>
          </div>
        )}

        {step === "handover" && (
          <fieldset>
            <legend className="mb-3 text-sm font-medium">{t("booking.handoverTitle")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {HANDOVER_METHODS.map((m) => (
                <ChoiceCard
                  key={m}
                  name="handover"
                  checked={draft.handoverMethod === m}
                  onChange={() => update({ handoverMethod: m })}
                  title={t(`handover.${m}.title`)}
                  description={t(`handover.${m}.body`)}
                />
              ))}
            </div>
            {errors.handoverMethod && <p role="alert" className="mt-2 text-sm text-danger">{errors.handoverMethod}</p>}
          </fieldset>
        )}

        {step === "location" && (
          <div className="space-y-5">
            {!editingContact && !errors.contactName && !errors.contactPhone && draft.contactName.trim().length >= 2 && isCompleteNational(nationalDigits(draft.contactPhone)) ? (
              // Known from the account or the last booking: confirm instead of retyping.
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted p-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t("booking.contact")}</p>
                  <p className="truncate font-semibold">{draft.contactName}</p>
                  <p className="text-sm text-muted">+91 {formatNational(nationalDigits(draft.contactPhone))}</p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => setEditingContact(true)}>
                  {t("common.edit")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("booking.contactName")} error={errors.contactName} required>
                  {(p) => <Input {...p} autoComplete="name" value={draft.contactName} onChange={(e) => update({ contactName: e.target.value })} />}
                </Field>
                <Field label={t("booking.contactPhone")} error={errors.contactPhone} required>
                  {(p) => <PhoneInput {...p} value={draft.contactPhone} onChange={(d) => update({ contactPhone: d })} />}
                </Field>
              </div>
            )}
            {needsAddress && (
              <div className="space-y-4">
                <p className="text-sm font-medium">{t("booking.addressTitle")}</p>
                <Field label={t("booking.addressLine1")} error={errors.addressLine1 ?? errors["address.addressLine1"]} required>
                  {(p) => <Input {...p} autoComplete="address-line1" value={draft.address.addressLine1} onChange={(e) => update({ address: { ...draft.address, addressLine1: e.target.value } })} />}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("booking.addressLine2")}>
                    {(p) => <Input {...p} autoComplete="address-line2" value={draft.address.addressLine2} onChange={(e) => update({ address: { ...draft.address, addressLine2: e.target.value } })} />}
                  </Field>
                  <Field label={t("booking.landmark")}>
                    {(p) => <Input {...p} value={draft.address.landmark} onChange={(e) => update({ address: { ...draft.address, landmark: e.target.value } })} />}
                  </Field>
                </div>
                <Field label={t("booking.pincode")} error={errors.pincode ?? errors["address.pincode"]} required>
                  {(p) => (
                    <div className="flex gap-2">
                      <Input
                        {...p}
                        inputMode="numeric"
                        autoComplete="postal-code"
                        maxLength={6}
                        value={draft.address.pincode}
                        onChange={(e) => {
                          update({ address: { ...draft.address, pincode: e.target.value.replace(/\D/g, "") } });
                          setPincodeState(null);
                        }}
                        className="max-w-40"
                      />
                      <Button type="button" variant="secondary" onClick={() => void checkPincode(draft.address.pincode)}>
                        {t("booking.checkPincode")}
                      </Button>
                    </div>
                  )}
                </Field>
                {pincodeState?.pincode === draft.address.pincode &&
                  (pincodeState.serviceable ? (
                    <Alert tone="success">{t("booking.serviceable", { locality: pincodeState.locality ?? "" })}</Alert>
                  ) : (
                    <Alert tone="warning" title={t("booking.unserviceableTitle")}>
                      <p>{t("booking.unserviceableBody")}</p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        <button type="button" className="font-medium underline" onClick={() => { update({ handoverMethod: "WALK_IN" }); setPincodeState(null); }}>
                          {t("handover.WALK_IN.title")}
                        </button>
                        <Link href={`/${locale}/help`} className="font-medium underline">
                          {t("nav.help")}
                        </Link>
                      </div>
                    </Alert>
                  ))}
                <Field label={t("booking.handoverNotes")}>
                  {(p) => <Textarea {...p} className="min-h-16" maxLength={500} value={draft.handoverNotes} onChange={(e) => update({ handoverNotes: e.target.value })} />}
                </Field>
              </div>
            )}
          </div>
        )}

        {step === "slot" && (
          <fieldset>
            <legend className="mb-1 text-sm font-medium">{t("booking.slotTitle")}</legend>
            <p className="mb-3 text-sm text-muted">{t("booking.slotHint")}</p>
            {slots.loading ? (
              <Skeleton className="h-40" />
            ) : !slots.data?.length ? (
              <Alert tone="warning">{t("booking.noSlots")}</Alert>
            ) : (
              <SlotPicker slots={slots.data} value={draft.slotId} onChange={(slotId) => update({ slotId })} />
            )}
            {errors.slotId && <p role="alert" className="mt-2 text-sm text-danger">{errors.slotId}</p>}
          </fieldset>
        )}

        {step === "review" && (
          <div className="space-y-5">
            <DescriptionList
              items={[
                [t("booking.device"), `${draft.modelName ?? ""}${selectedCategory ? ` · ${localized(locale, selectedCategory.nameEn, selectedCategory.nameHi)}` : ""}`],
                [t("booking.issues"), selectedIssues.map((i) => localized(locale, i.nameEn, i.nameHi)).join(", ")],
                [t("booking.handover"), draft.handoverMethod ? t(`handover.${draft.handoverMethod}.title`) : ""],
                [t("booking.appointment"), selectedSlot ? `${formatDate(selectedSlot.date, locale)}, ${selectedSlot.startTime}–${selectedSlot.endTime}` : ""],
                ...(needsAddress ? [[t("booking.address"), [draft.address.addressLine1, draft.address.addressLine2, draft.address.landmark, `Jaipur ${draft.address.pincode}`].filter(Boolean).join(", ")] as [string, string]] : []),
                [t("booking.contact"), `${draft.contactName} · +91 ${formatNational(nationalDigits(draft.contactPhone))}`],
                [t("booking.photos"), t("booking.photosCount", { count: photos.length })],
              ]}
            />
            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-medium">{t("booking.diagnosisFee")}</p>
                {fee.loading ? <Skeleton className="h-5 w-16" /> : <p className="text-lg font-semibold">{fee.data ? formatPaise(fee.data.feePaise, locale) : "—"}</p>}
              </div>
              {fee.data && <p className="mt-1 text-sm text-muted">{fee.data.waivedIfApproved ? t("booking.feeWaived") : t("booking.feeNotWaived")}</p>}
            </div>
            <p className="text-sm text-muted">{t("booking.nextSteps")}</p>
            <Checkbox
              checked={draft.acceptPolicy}
              onChange={(e) => update({ acceptPolicy: e.target.checked })}
              aria-invalid={!!errors.acceptPolicy || undefined}
              label={
                <>
                  {t("booking.acceptPolicy").split("{policy}")[0]}
                  <Link href={`/${locale}/policies/repair`} target="_blank" className="text-primary underline">
                    {t("booking.policyLink")}
                  </Link>
                  {t("booking.acceptPolicy").split("{policy}")[1]}
                </>
              }
            />
            {errors.acceptPolicy && <p role="alert" className="text-sm text-danger">{errors.acceptPolicy}</p>}

            {!signedIn && (
              <div className="rounded-lg border border-primary/30 bg-primary-soft p-4">
                <p className="mb-4 text-sm">{t("booking.signInNotice")}</p>
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

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
          {draft.step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => goTo(draft.step - 1)} disabled={!!submitting}>
              {t("common.back")}
            </Button>
          ) : (
            <span />
          )}
          {step !== "review" ? (
            <Button type="button" onClick={() => void validateAndNext()}>
              {t("common.next")}
            </Button>
          ) : (
            <Button type="button" onClick={() => void submit()} pending={!!submitting} disabled={!signedIn}>
              {submitting === "uploading" ? t("booking.uploading") : submitting === "submitting" ? t("booking.submitting") : signedIn ? t("booking.submit") : t("booking.signInToSubmit")}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function ChoiceCard({
  name,
  type = "radio",
  checked,
  onChange,
  title,
  description,
  compact,
}: {
  name: string;
  type?: "radio" | "checkbox";
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border bg-surface transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]",
        compact ? "px-3 py-2.5" : "p-3.5",
        checked ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-muted",
      )}
    >
      <input type={type} name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}

/**
 * Models arrive popular-first, newest-first. Without a search they are grouped (Popular, then by launch year)
 * so a brand with 80+ models stays scannable; a search shows one flat list.
 */
function ModelPicker({
  models,
  loading,
  value,
  error,
  onSelect,
}: {
  models: ModelOption[] | null;
  loading: boolean;
  value?: string;
  error?: string;
  onSelect: (m: Named) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => (models ?? []).filter((m) => m.name.toLowerCase().includes(q)), [models, q]);
  const groups = useMemo(() => {
    if (q) return [{ key: "results", label: null, items: filtered }];
    const out = new Map<string, { key: string; label: string | null; items: ModelOption[] }>();
    const add = (key: string, label: string, m: ModelOption) => (out.get(key) ?? out.set(key, { key, label, items: [] }).get(key)!).items.push(m);
    for (const m of filtered) if (m.popular) add("popular", t("booking.popularModels"), m);
    for (const m of filtered) if (!m.popular) add(m.releaseYear ? String(m.releaseYear) : "older", m.releaseYear ? String(m.releaseYear) : t("booking.olderModels"), m);
    return [...out.values()];
  }, [filtered, q, t]);
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{t("booking.model")}</legend>
      <Input type="search" placeholder={t("booking.searchModel")} aria-label={t("booking.searchModel")} value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2" />
      {loading ? (
        <Skeleton className="h-24" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">{t("booking.noModels")}</p>
      ) : (
        <div className="max-h-96 space-y-4 overflow-y-auto overscroll-contain pr-1">
          {groups.map((g) => (
            <div key={g.key}>
              {g.label && <p className="sticky top-0 z-10 mb-1.5 bg-surface py-1 text-xs font-semibold tracking-wide text-muted uppercase">{g.label}</p>}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {g.items.map((m) => (
                  <ChoiceCard key={m.id} name="model" checked={value === m.id} onChange={() => onSelect(m)} title={m.name} compact />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </fieldset>
  );
}

function SlotPicker({ slots, value, onChange }: { slots: Slot[]; value?: string; onChange: (id: string) => void }) {
  const { t, locale } = useI18n();
  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return [...map.entries()];
  }, [slots]);
  return (
    <div className="space-y-4">
      {byDate.map(([date, list]) => (
        <div key={date}>
          <p className="mb-2 text-sm font-medium">{formatDate(date, locale)}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {list.map((s) => {
              const full = s.remaining <= 0;
              return (
                <label
                  key={s.id}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]",
                    full && "cursor-not-allowed opacity-50",
                    value === s.id ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-muted",
                  )}
                >
                  <input type="radio" name="slot" className="sr-only" disabled={full} checked={value === s.id} onChange={() => onChange(s.id)} />
                  <span className="font-medium">
                    {s.startTime}–{s.endTime}
                  </span>
                  <span className="text-xs text-muted">{full ? t("booking.slotFull") : t("booking.slotsLeft", { count: s.remaining })}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
