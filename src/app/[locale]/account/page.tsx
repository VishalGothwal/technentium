import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { requireCustomerPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { isDeliverableEmail } from "@/server/providers/email";
import { OPTIONAL_CHANNELS } from "@/server/notifications/matrix";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { PreferencesForm, ProfileForm } from "./profile-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("account.profileTitle"), robots: { index: false } };
}

export default async function ProfilePage() {
  const { t, locale } = await getT();
  const actor = await requireCustomerPage(locale, `/${locale}/account`);
  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.userId },
    select: { name: true, email: true, emailVerified: true, phoneNumber: true, phoneNumberVerified: true, preferredLocale: true, notificationPrefs: true },
  });
  const disabled = new Set(user.notificationPrefs.filter((p) => !p.enabled).map((p) => p.channel));
  const verified = (ok: boolean | null) => <Badge tone={ok ? "success" : "neutral"}>{ok ? t("account.verified") : t("account.notVerified")}</Badge>;

  return (
    <div className="space-y-5">
      <PageHeader title={t("account.profileTitle")} />
      <Card>
        <CardBody className="space-y-5">
          <DescriptionList
            items={[
              [t("account.phone"), user.phoneNumber ? <span key="p" className="flex flex-wrap items-center gap-2">{user.phoneNumber} {verified(user.phoneNumberVerified)}</span> : null],
              [t("account.email"), isDeliverableEmail(user.email) ? <span key="e" className="flex flex-wrap items-center gap-2">{user.email} {verified(user.emailVerified)}</span> : null],
            ]}
          />
          <ProfileForm name={user.name === "Customer" ? "" : user.name} preferredLocale={user.preferredLocale === "hi" ? "hi" : locale} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("account.preferencesTitle")} description={t("account.preferencesHint")} />
        <CardBody>
          <PreferencesForm channels={OPTIONAL_CHANNELS.map((c) => ({ channel: c, enabled: !disabled.has(c) }))} />
        </CardBody>
      </Card>
    </div>
  );
}
