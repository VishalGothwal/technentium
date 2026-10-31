import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import type { Locale } from "@/i18n/config";
import { ButtonLink } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/surface";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("checkout.successTitle"), robots: { index: false } };
}

/** FR-PROD-13: the confirmation states plainly that this is a request, not a confirmed or paid order. */
export default async function CheckoutSuccessPage({ searchParams }: PageProps<"/[locale]/protection/checkout/success">) {
  const { locale } = await getT();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Suspense fallback={<PageSkeleton />}>
        <Success locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Success({ locale, searchParams }: { locale: Locale; searchParams: PageProps<"/[locale]/protection/checkout/success">["searchParams"] }) {
  const { t } = await getT();
  const raw = (await searchParams).ref;
  const reference = typeof raw === "string" && /^TN-P-\d{4}-\d{5,}$/.test(raw) ? raw : null;
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 text-center sm:p-10">
      <div aria-hidden className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-3xl text-success">
        ✓
      </div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{t("checkout.successTitle")}</h1>
      {reference && <p className="mt-3 text-muted">{t("checkout.successBody", { reference })}</p>}
      <ol className="mx-auto mt-8 max-w-md space-y-3 text-left">
        <li className="text-sm font-semibold tracking-wide text-muted uppercase">{t("checkout.whatNext")}</li>
        {[t("checkout.next1"), t("checkout.next2"), t("checkout.next3")].map((line, i) => (
          <li key={line} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-white">{i + 1}</span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {reference && (
          <ButtonLink href={`/${locale}/account/orders/${reference}`} size="lg" className="rounded-xl">
            {t("checkout.track")}
          </ButtonLink>
        )}
        <ButtonLink href={`/${locale}/protection/products`} size="lg" variant="secondary" className="rounded-xl">
          {t("checkout.keepShopping")}
        </ButtonLink>
      </div>
    </div>
  );
}
