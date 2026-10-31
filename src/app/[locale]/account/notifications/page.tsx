import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { requireCustomerPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { render } from "@/server/notifications/templates";
import type { NotificationType } from "@/server/modules/repairs/state-machine";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { EmptyState, PageHeader } from "@/components/ui/surface";
import { MarkAllReadButton } from "./mark-read";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("account.notificationsTitle"), robots: { index: false } };
}

export default async function NotificationsPage() {
  const { t, locale } = await getT();
  const actor = await requireCustomerPage(locale, `/${locale}/account/notifications`);
  const items = await db.inAppNotification.findMany({ where: { userId: actor.userId }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.some((i) => !i.readAt);

  return (
    <>
      <PageHeader title={t("account.notificationsTitle")} actions={unread ? <MarkAllReadButton /> : null} />
      {items.length === 0 ? (
        <EmptyState title={t("account.noNotifications")} />
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius)] border border-border bg-surface">
          {items.map((n) => {
            const msg = render(n.titleKey as NotificationType, locale, n.params as Record<string, string>);
            const body = (
              <>
                <p className={cn("text-sm", !n.readAt && "font-semibold")}>
                  {!n.readAt && <span className="mr-2 inline-block size-2 rounded-full bg-primary" aria-hidden />}
                  {msg.title}
                </p>
                <p className="text-sm text-muted">{msg.body}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt, locale)}</p>
              </>
            );
            return (
              <li key={n.id} className="p-4">
                {n.href ? (
                  <Link href={`/${locale}${n.href}`} className="block hover:underline">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
