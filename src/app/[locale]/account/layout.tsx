import Link from "next/link";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { PageSkeleton } from "@/components/ui/surface";

// Every account page reads the session; each page redirects guests via requireCustomerPage().
export const instant = false;

export default async function AccountLayout({ children }: LayoutProps<"/[locale]/account">) {
  const { t, locale } = await getT();
  const tabs = [
    { href: `/${locale}/account/bookings`, label: t("account.bookingsTitle") },
    { href: `/${locale}/account/orders`, label: t("account.ordersTitle") },
    { href: `/${locale}/account/designs`, label: t("account.designsTitle") },
    { href: `/${locale}/account/notifications`, label: t("account.notificationsTitle") },
    { href: `/${locale}/account`, label: t("account.profileTitle") },
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label={t("common.myAccount")} className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-muted hover:text-foreground">
            {tab.label}
          </Link>
        ))}
      </nav>
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </div>
  );
}
