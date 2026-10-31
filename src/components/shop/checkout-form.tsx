"use client";
import { track } from "@/components/site/analytics";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { Alert } from "@/components/ui/surface";
import { useI18n } from "@/i18n/client";
import { INDIAN_STATES } from "@/lib/schemas/shop";
import { submitOrderAction } from "@/app/[locale]/protection/actions";

type Values = { contactName: string; contactPhone: string; addressLine1: string; addressLine2: string; city: string; state: string; pincode: string; notes: string };

/** Order-request form. One idempotency key per form instance, so a double submit or retry never duplicates. */
export function CheckoutForm({ defaults }: { defaults: Partial<Values> }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState<Values>({
    contactName: "",
    contactPhone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    notes: "",
    ...defaults,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (k: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await submitOrderAction(values, key);
      if (res.ok) {
        track("order_request_submitted");
        router.push(`/${locale}/protection/checkout/success?ref=${encodeURIComponent(res.data.reference)}`);
        return;
      }
      setError(t(res.messageKey));
      setErrors(Object.fromEntries(Object.entries(res.fields ?? {}).map(([k, v]) => [k, t(v)])));
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}

      <fieldset className="space-y-4 rounded-3xl border border-border bg-surface p-5">
        <legend className="px-1 text-lg font-semibold">{t("checkout.contactTitle")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("checkout.name")} error={errors.contactName} required>
            {(p) => <Input {...p} autoComplete="name" value={values.contactName} onChange={set("contactName")} />}
          </Field>
          <Field label={t("checkout.phone")} error={errors.contactPhone} required>
            {(p) => <PhoneInput {...p} value={values.contactPhone} onChange={(d) => setValues((v) => ({ ...v, contactPhone: d }))} />}
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-3xl border border-border bg-surface p-5">
        <legend className="px-1 text-lg font-semibold">{t("checkout.addressTitle")}</legend>
        <Field label={t("checkout.line1")} error={errors.addressLine1} required>
          {(p) => <Input {...p} autoComplete="address-line1" value={values.addressLine1} onChange={set("addressLine1")} />}
        </Field>
        <Field label={t("checkout.line2")} error={errors.addressLine2}>
          {(p) => <Input {...p} autoComplete="address-line2" value={values.addressLine2} onChange={set("addressLine2")} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("checkout.city")} error={errors.city} required>
            {(p) => <Input {...p} autoComplete="address-level2" value={values.city} onChange={set("city")} />}
          </Field>
          <Field label={t("checkout.state")} error={errors.state} required>
            {(p) => (
              <Select {...p} autoComplete="address-level1" value={values.state} onChange={set("state")}>
                <option value="">{t("checkout.selectState")}</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("checkout.pincode")} error={errors.pincode} required>
            {(p) => <Input {...p} inputMode="numeric" maxLength={6} autoComplete="postal-code" value={values.pincode} onChange={set("pincode")} />}
          </Field>
        </div>
        <Field label={t("checkout.notes")} hint={t("checkout.notesHint")} error={errors.notes}>
          {(p) => <Textarea {...p} value={values.notes} onChange={set("notes")} maxLength={1000} />}
        </Field>
      </fieldset>

      <div className="rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm">
        <p className="font-semibold text-warning">{t("checkout.disclaimerTitle")}</p>
        <p className="mt-1">{t("checkout.disclaimer")}</p>
      </div>

      <Button type="submit" size="lg" block pending={pending} className="rounded-xl">
        {pending ? t("checkout.submitting") : t("checkout.submit")}
      </Button>
    </form>
  );
}
