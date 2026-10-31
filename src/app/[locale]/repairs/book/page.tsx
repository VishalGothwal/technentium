import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/server/auth/session";
import { isDeliverableEmail } from "@/server/providers/email";
import { getDeviceModel, listIssues } from "@/server/modules/catalog/catalog.service";
import { lastBookingContact } from "@/server/modules/repairs/booking.service";
import { nationalDigits } from "@/lib/phone";
import { PageSkeleton } from "@/components/ui/surface";
import { BookingWizard, type BookingPrefill } from "./wizard";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/repairs/book", title: t("booking.title"), description: t("repairs.subtitle") });
}

type SearchParams = PageProps<"/[locale]/repairs/book">["searchParams"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** `?model=&issues=a,b&notes=` from a repair model page; ignored unless the model exists and the issues belong to it. */
async function readPrefill(searchParams: SearchParams): Promise<BookingPrefill | null> {
  const sp = await searchParams;
  const modelId = one(sp.model)?.slice(0, 40);
  if (!modelId) return null;
  const model = await getDeviceModel(modelId);
  if (!model) return null;
  const valid = new Set((await listIssues(model.category.id)).map((i) => i.id));
  return {
    categoryId: model.category.id,
    brandId: model.brand.id,
    modelId: model.id,
    modelName: model.name,
    issueTypeIds: (one(sp.issues) ?? "").split(",").filter((id) => valid.has(id)),
    description: (one(sp.notes) ?? "").slice(0, 500),
  };
}

async function WizardWithSession({ searchParams }: { searchParams: SearchParams }) {
  const [session, prefill] = await Promise.all([getSession(), readPrefill(searchParams)]);
  const user = session?.user as { id: string; name?: string; phoneNumber?: string | null; email?: string } | undefined;
  // Returning customers: reuse what they entered last time so nothing is typed twice.
  const last = user ? await lastBookingContact(user.id) : null;
  const accountName = user?.name && user.name !== "Customer" ? user.name : "";
  return (
    <BookingWizard
      // Remount after sign-in so the account's details fill the form.
      key={user?.id ?? "guest"}
      initialSignedIn={!!session}
      prefill={prefill}
      defaults={{
        contactName: last?.contactName || accountName,
        contactPhone: nationalDigits(user?.phoneNumber ?? last?.contactPhone ?? ""),
        address: last?.address ?? null,
        hasEmail: isDeliverableEmail(user?.email),
      }}
    />
  );
}

export default async function BookRepairPage({ searchParams }: PageProps<"/[locale]/repairs/book">) {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("booking.title")}</h1>
      <Suspense fallback={<div className="mt-6"><PageSkeleton /></div>}>
        <WizardWithSession searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
