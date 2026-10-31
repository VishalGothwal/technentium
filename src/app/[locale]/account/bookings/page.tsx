import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { requireCustomerPage } from "@/server/auth/guards";
import { listMyBookings } from "@/server/modules/repairs/booking.service";
import { formatDate } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/surface";
import { customerStatus } from "@/components/repair/status";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("account.bookingsTitle"), robots: { index: false } };
}

export default async function MyBookingsPage() {
  const { t, locale } = await getT();
  const bookings = await listMyBookings(await requireCustomerPage(locale, `/${locale}/account/bookings`));

  return (
    <>
      <PageHeader title={t("account.bookingsTitle")} actions={<ButtonLink href={`/${locale}/repairs/book`}>{t("nav.bookRepair")}</ButtonLink>} />
      {bookings.length === 0 ? (
        <EmptyState title={t("account.noBookings")} action={<ButtonLink href={`/${locale}/repairs/book`}>{t("home.cta")}</ButtonLink>} />
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => {
            const s = customerStatus(b.status, b.job);
            return (
              <li key={b.reference}>
                <Link
                  href={`/${locale}/account/bookings/${b.reference}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-surface p-4 hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {b.model.brand.name} {b.model.name}
                    </p>
                    <p className="text-sm text-muted">
                      {b.reference} · {t("account.bookedOn", { date: formatDate(b.createdAt, locale) })}
                    </p>
                  </div>
                  <Badge tone={s.tone}>{t(`status.${s.kind}.${s.status}`)}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
