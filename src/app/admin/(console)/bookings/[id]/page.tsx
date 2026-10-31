import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { can } from "@/server/rbac/actor";
import { getBookingForStaff } from "@/server/modules/repairs/booking.service";
import { listTechnicians } from "@/server/modules/repairs/job.service";
import { listAvailableSlots } from "@/server/modules/catalog/catalog.service";
import { createT } from "@/i18n/translate";
import { formatDate, formatDateTime, formatPaise } from "@/lib/format";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { BOOKING_TONE } from "@/components/repair/status";
import { BookingActions } from "./booking-actions";

export const metadata = { title: "Booking" };
export const instant = false;

const t = createT("en");

export default async function AdminBookingPage({ params }: PageProps<"/admin/bookings/[id]">) {
  const actor = await requireStaffPage();
  const { id } = await params;
  let booking;
  try {
    booking = await getBookingForStaff(actor, id);
  } catch (e) {
    if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }

  const open = booking.status === "SUBMITTED" || booking.status === "NEEDS_INFO";
  const reschedulable = booking.status === "SUBMITTED" || (booking.status === "CONFIRMED" && booking.job?.status === "AWAITING_HANDOVER");
  const [technicians, slots] = await Promise.all([
    can(actor, "job.assign") ? listTechnicians() : Promise.resolve([]),
    reschedulable && can(actor, "booking.reschedule") ? listAvailableSlots(14) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={booking.reference}
        description={`${booking.model.brand.name} ${booking.model.name} · ${booking.model.category.nameEn}`}
        actions={
          <>
            <Badge tone={BOOKING_TONE[booking.status]} className="text-sm">
              {t(`status.booking.${booking.status}`)}
            </Badge>
            {booking.job && (
              <Link href={`/admin/jobs/${booking.job.id}`} className="text-sm text-primary hover:underline">
                Open repair job →
              </Link>
            )}
          </>
        }
      />

      {booking.statusReason && (
        <Alert tone={booking.status === "NEEDS_INFO" ? "warning" : "neutral"} title="Latest reason / message" className="mb-4">
          {booking.statusReason}
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Request" />
            <CardBody>
              <DescriptionList
                items={[
                  ["Issues", booking.issues.map((i) => i.issueType.nameEn).join(", ")],
                  ["Description", booking.description ? <span key="d" className="whitespace-pre-line">{booking.description}</span> : null],
                  ["Handover", t(`handover.${booking.handoverMethod}.title`)],
                  ["Preferred slot", booking.slot ? `${formatDate(booking.slot.date)}, ${booking.slot.startTime}–${booking.slot.endTime}` : null],
                  [
                    "Address",
                    booking.handover?.addressLine1
                      ? [booking.handover.addressLine1, booking.handover.addressLine2, booking.handover.landmark, booking.handover.pincode].filter(Boolean).join(", ")
                      : null,
                  ],
                  ["Handover notes", booking.handover?.notes],
                  ["Diagnosis fee disclosed", `${formatPaise(booking.diagnosisFeePaise)} (${booking.feeWaivedIfApproved ? "waived if approved" : "always charged"}) · policy ${booking.policyVersion}`],
                  ["Submitted", formatDateTime(booking.createdAt)],
                ]}
              />
              {booking.attachments.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {booking.attachments.map((a, i) => (
                    <a key={a.id} href={`/api/v1/attachments/${a.id}`} target="_blank" className="block aspect-square overflow-hidden rounded-md border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/v1/attachments/${a.id}`} alt={`Customer photo ${i + 1}`} className="size-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="History" />
            <CardBody>
              <ol className="space-y-2 text-sm">
                {booking.history.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-x-2">
                    <span className="text-muted">{formatDateTime(h.createdAt)}</span>
                    <span className="font-medium">{t(`status.${h.entityType === "JOB" ? "job" : "booking"}.${h.toStatus}`)}</span>
                    {h.reason && <span className="text-muted">— {h.reason}</span>}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Customer" />
            <CardBody>
              <DescriptionList
                items={[
                  ["Contact", booking.contactName],
                  ["Phone", <a key="p" href={`tel:${booking.contactPhone}`} className="text-primary hover:underline">{booking.contactPhone}</a>],
                  ["Account", can(actor, "customer.view") ? <Link key="c" href={`/admin/customers/${booking.customer.id}`} className="text-primary hover:underline">{booking.customer.name}</Link> : booking.customer.name],
                ]}
              />
            </CardBody>
          </Card>

          <BookingActions
            bookingId={booking.id}
            status={booking.status}
            open={open}
            reschedulable={reschedulable}
            canConfirm={can(actor, "booking.confirm")}
            canDecline={can(actor, "booking.decline")}
            canRequestInfo={can(actor, "booking.request_info")}
            canReschedule={can(actor, "booking.reschedule")}
            canCancel={can(actor, "booking.cancel") && (open || booking.job?.status === "AWAITING_HANDOVER")}
            technicians={technicians}
            slots={slots.filter((s) => s.id !== booking.slotId)}
          />
        </div>
      </div>
    </>
  );
}
