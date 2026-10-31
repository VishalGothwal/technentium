import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { getSetting } from "@/server/settings";
import { ButtonLink } from "@/components/ui/button";
import { Card, DescriptionList, Skeleton } from "@/components/ui/surface";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/help", title: t("help.title"), description: t("help.intro") });
}

async function ContactDetails() {
  "use cache";
  const { t } = await getT();
  const [phone, address] = await Promise.all([getSetting("business.supportPhone"), getSetting("business.shopAddress")]);
  return (
    <DescriptionList
      items={[
        [t("help.phone"), <a key="p" href={`tel:${phone.replace(/\s/g, "")}`} className="text-primary hover:underline">{phone}</a>],
        [t("help.address"), address],
        [t("help.hours"), t("help.hoursValue")],
      ]}
    />
  );
}

export default async function HelpPage() {
  const { t, locale } = await getT();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{t("help.title")}</h1>
      <p className="mt-2 text-muted">{t("help.intro")}</p>
      <Card className="mt-8 p-5">
        <Suspense fallback={<Skeleton className="h-20" />}>
          <ContactDetails />
        </Suspense>
      </Card>
      <Card className="mt-4 p-5">
        <h2 className="font-semibold">{t("help.trackTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("help.trackBody")}</p>
        <ButtonLink href={`/${locale}/account/bookings`} variant="secondary" className="mt-4">
          {t("common.myBookings")}
        </ButtonLink>
      </Card>
    </div>
  );
}
