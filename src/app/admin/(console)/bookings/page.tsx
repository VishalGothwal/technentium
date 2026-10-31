import Link from "next/link";
import type { BookingStatus } from "@/generated/prisma/enums";
import { requireStaffPage } from "@/server/auth/guards";
import { listBookingsForStaff } from "@/server/modules/repairs/booking.service";
import { createT } from "@/i18n/translate";
import { formatDate, formatDateTime } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/surface";
import { BOOKING_TONE } from "@/components/repair/status";

export const metadata = { title: "Booking queue" };
export const instant = false;

const t = createT("en");
const STATUSES = ["OPEN", "SUBMITTED", "NEEDS_INFO", "CONFIRMED", "DECLINED", "CANCELLED"] as const;

export default async function BookingQueuePage({ searchParams }: PageProps<"/admin/bookings">) {
  const actor = await requireStaffPage();
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(String(sp.status)) ? (String(sp.status) as BookingStatus | "OPEN") : "OPEN";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const page = Number(sp.page) || 1;
  const { items, total, pageSize } = await listBookingsForStaff(actor, { status, q: q || undefined, page });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const qs = (p: number) => `?${new URLSearchParams({ status, ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Booking queue" description="Every booking is confirmed by staff before the device is handed over." />

      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Status</span>
          <select name="status" defaultValue={status} className="h-10 rounded-lg border border-border bg-surface px-3">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "OPEN" ? "Open (needs action)" : t(`status.booking.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm sm:max-w-xs">
          <span className="text-muted">Search</span>
          <input name="q" defaultValue={q} placeholder="Reference, name or phone" className="h-10 rounded-lg border border-border bg-surface px-3" />
        </label>
        <Button type="submit" variant="secondary" size="sm" className="h-10">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No bookings match" description="New bookings appear here as soon as customers submit them." />
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {items.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/bookings/${b.id}`} className="block rounded-[var(--radius)] border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{b.reference}</span>
                    <Badge tone={BOOKING_TONE[b.status]}>{t(`status.booking.${b.status}`)}</Badge>
                  </div>
                  <p className="mt-1 text-sm">
                    {b.model.brand.name} {b.model.name} · {b.contactName}
                  </p>
                  <p className="text-xs text-muted">
                    {t(`handover.${b.handoverMethod}.title`)} · {b.slot ? `${formatDate(b.slot.date)} ${b.slot.startTime}` : "No slot"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-[var(--radius)] border border-border bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted text-left text-muted">
                <tr>
                  {["Reference", "Device & issues", "Customer", "Handover", "Preferred slot", "Submitted", "Status"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted/60">
                    <td className="px-3 py-2">
                      <Link href={`/admin/bookings/${b.id}`} className="font-medium text-primary hover:underline">
                        {b.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {b.model.brand.name} {b.model.name}
                      <span className="block text-xs text-muted">{b.issues.map((i) => i.issueType.nameEn).join(", ")}</span>
                    </td>
                    <td className="px-3 py-2">
                      {b.contactName}
                      <span className="block text-xs text-muted">{b.contactPhone}</span>
                    </td>
                    <td className="px-3 py-2">
                      {t(`handover.${b.handoverMethod}.title`)}
                      {b.handover?.pincode && <span className="block text-xs text-muted">{b.handover.pincode}</span>}
                    </td>
                    <td className="px-3 py-2">{b.slot ? `${formatDate(b.slot.date)} ${b.slot.startTime}–${b.slot.endTime}` : "—"}</td>
                    <td className="px-3 py-2 text-muted">{formatDateTime(b.createdAt)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={BOOKING_TONE[b.status]}>{t(`status.booking.${b.status}`)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted">
                Page {page} of {pages} · {total} bookings
              </span>
              <div className="flex gap-2">
                {page > 1 && <ButtonLink href={qs(page - 1)} variant="secondary" size="sm">Previous</ButtonLink>}
                {page < pages && <ButtonLink href={qs(page + 1)} variant="secondary" size="sm">Next</ButtonLink>}
              </div>
            </nav>
          )}
        </>
      )}
    </>
  );
}
