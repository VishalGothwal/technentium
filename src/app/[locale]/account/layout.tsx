import Link from "next/link";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { PageSkeleton } from "@/components/ui/surface";
import { SignOutButton } from "@/components/site/sign-out-button";

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
      <div className="mb-6 flex items-center gap-2 border-b border-border">
        <nav aria-label={t("common.myAccount")} className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-muted hover:text-foreground">
              {tab.label}
            </Link>
          ))}
        </nav>
        {/* The desktop header has no sign-out (only the mobile menu does), so every account page offers it. */}
        <SignOutButton label={t("common.signOut")} redirectTo={`/${locale}`} className="shrink-0" />
      </div>
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </div>
  );
}
