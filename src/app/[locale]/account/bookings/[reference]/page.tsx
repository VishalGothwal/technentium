import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { requireCustomerPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getMyBooking } from "@/server/modules/repairs/booking.service";
import { declineCharges } from "@/server/modules/quotes/quote.service";
import { CUSTOMER_STEPS, customerStep } from "@/server/modules/repairs/state-machine";
import { formatDate, formatDateTime, formatPaise } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/surface";
import { customerStatus } from "@/components/repair/status";
import { QuoteTable } from "@/components/repair/quote-table";
import { CancelBookingButton, InfoReplyForm, QuoteDecision } from "./client";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/account/bookings/[reference]">): Promise<Metadata> {
  const { reference } = await params;
  return { title: reference, robots: { index: false } };
}

export default async function BookingDetailPage({ params }: PageProps<"/[locale]/account/bookings/[reference]">) {
  const { reference } = await params;
  const { t, locale } = await getT();

  const actor = await requireCustomerPage(locale, `/${locale}/account/bookings/${reference}`);
  let booking;
  try {
    booking = await getMyBooking(actor, reference);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const job = booking.job;
  const status = customerStatus(booking.status, job);
  const current = customerStep(booking.status, job?.status ?? null, job?.previousStatus);
  const currentIndex = CUSTOMER_STEPS.indexOf(current);
  const quote = booking.visibleQuote;
  const now = new Date();
  const quoteActionable =
    !!quote && quote.status === "SENT" && job?.status === "AWAITING_DECISION" && (!quote.expiresAt || quote.expiresAt > now);
  const charges = quoteActionable ? await declineCharges(booking.diagnosisFeePaise) : null;
  const terminalBooking = booking.status === "DECLINED" || booking.status === "CANCELLED";
  const latestReturn = job?.returns[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {t("tracking.reference")} {booking.reference}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            {booking.model.brand.name} {booking.model.name}
          </h1>
        </div>
        <Badge tone={status.tone} className="text-sm">
          {t(`status.${status.kind}.${status.status}`)}
        </Badge>
      </div>

      {booking.status === "NEEDS_INFO" && (
        <Alert tone="warning" title={t("tracking.needsInfoTitle")}>
          <p className="whitespace-pre-line">{booking.statusReason}</p>
          <InfoReplyForm reference={booking.reference} />
        </Alert>
      )}
      {booking.status === "DECLINED" && (
        <Alert tone="danger" title={t("tracking.declinedTitle")}>
          {booking.statusReason}
        </Alert>
      )}

      {!terminalBooking && (
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">{t("tracking.timeline")}</h2>
          <ol className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8" aria-live="polite">
            {CUSTOMER_STEPS.map((s, i) => (
              <li key={s} aria-current={i === currentIndex ? "step" : undefined} className="flex items-center gap-2 sm:flex-col sm:items-start">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    i < currentIndex && "border-primary bg-primary text-primary-foreground",
                    i === currentIndex && "border-primary bg-primary-soft text-primary ring-2 ring-primary/30",
                    i > currentIndex && "border-border text-muted",
                  )}
                >
                  {i < currentIndex ? "✓" : i + 1}
                </span>
                <span className={cn("text-xs", i === currentIndex ? "font-semibold" : "text-muted")}>{t(`tracking.steps.${s}`)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {quote && (
        <Card>
          <CardHeader
            title={t("quote.title")}
            description={
              <>
                {t("quote.version", { number: quote.number })}
                {quote.status === "SENT" && quote.expiresAt && <> · {t("quote.expires", { date: formatDate(quote.expiresAt, locale) })}</>}
              </>
            }
          />
          <CardBody className="space-y-4">
            {quote.customerMessage && <p className="text-sm">{quote.customerMessage}</p>}
            <QuoteTable version={quote} locale={locale} t={t} />
            {quote.status === "EXPIRED" || (quote.status === "SENT" && !quoteActionable) ? (
              <Alert tone="warning">{t("quote.expired")}</Alert>
            ) : quote.decision ? (
              <Alert tone={quote.decision.decision === "APPROVED" ? "success" : "neutral"}>
                {t(quote.decision.decision === "APPROVED" ? "quote.decidedApproved" : "quote.decidedDeclined", { date: formatDateTime(quote.decision.createdAt, locale) })}
              </Alert>
            ) : null}
            {quoteActionable && charges && (
              <QuoteDecision
                versionId={quote.id}
                totalLabel={formatPaise(quote.totalPaise, locale)}
                charges={charges}
                defaultAddress={booking.handover?.addressLine1 ? { addressLine1: booking.handover.addressLine1, addressLine2: booking.handover.addressLine2 ?? "", pincode: booking.handover.pincode ?? "" } : null}
              />
            )}
          </CardBody>
        </Card>
      )}

      {latestReturn && (
        <Card className="p-5">
          <h2 className="font-semibold">{t("tracking.returnTitle")}</h2>
          <DescriptionList
            className="mt-3"
            items={[
              [t("quote.returnMethod"), t(`tracking.returnMethod.${latestReturn.method}`)],
              [t("tracking.status"), t(`tracking.returnStatus.${latestReturn.status}`, { date: latestReturn.scheduledAt ? formatDateTime(latestReturn.scheduledAt, locale) : "" })],
              ...(latestReturn.chargePaise > 0 ? [[t("tracking.returnCharge"), formatPaise(latestReturn.chargePaise, locale)] as [string, string]] : []),
            ]}
          />
        </Card>
      )}

      {job?.warranty && (
        <Card className="p-5">
          <h2 className="font-semibold">{t("tracking.warrantyTitle")}</h2>
          <p className="mt-1 text-sm">{t("tracking.warrantyUntil", { date: formatDate(job.warranty.endsAt, locale) })}</p>
          <p className="mt-2 text-sm text-muted">{localized(locale, job.warranty.policy.termsEn, job.warranty.policy.termsHi)}</p>
        </Card>
      )}

      {!!job?.notes.length && (
        <Card className="p-5">
          <h2 className="font-semibold">{t("tracking.messagesTitle")}</h2>
          <ul className="mt-3 space-y-3">
            {job.notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-surface-muted p-3 text-sm">
                <p className="whitespace-pre-line">{n.body}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt, locale)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">{t("tracking.historyTitle")}</h2>
          <ol className="mt-3 space-y-3 border-l border-border pl-4">
            {[...booking.history].reverse().map((h) => (
              <li key={h.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
                <p className="font-medium">{t(`status.${h.entityType === "JOB" ? "job" : "booking"}.${h.toStatus}`)}</p>
                {h.reason && <p className="text-muted">{h.reason}</p>}
                <p className="text-xs text-muted">{formatDateTime(h.createdAt, locale)}</p>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">{t("tracking.details")}</h2>
          <DescriptionList
            className="mt-3"
            items={[
              [t("booking.issues"), booking.issues.map((i) => localized(locale, i.issueType.nameEn, i.issueType.nameHi)).join(", ")],
              [t("booking.handover"), t(`handover.${booking.handoverMethod}.title`)],
              [t("booking.appointment"), booking.slot ? `${formatDate(booking.slot.date, locale)}, ${booking.slot.startTime}–${booking.slot.endTime}` : null],
              ...(booking.handover?.addressLine1
                ? [[t("booking.address"), [booking.handover.addressLine1, booking.handover.addressLine2, booking.handover.landmark, booking.handover.pincode].filter(Boolean).join(", ")] as [string, string]]
                : []),
              [t("booking.diagnosisFee"), `${formatPaise(booking.diagnosisFeePaise, locale)} — ${booking.feeWaivedIfApproved ? t("booking.feeWaived") : t("booking.feeNotWaived")}`],
            ]}
          />
          {booking.attachments.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {booking.attachments.map((a, i) => (
                <a key={a.id} href={`/api/v1/attachments/${a.id}`} target="_blank" className="block aspect-square overflow-hidden rounded-md border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/v1/attachments/${a.id}`} alt={t("booking.photoAlt", { index: i + 1 })} className="size-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          )}
          {(booking.status === "SUBMITTED" || booking.status === "NEEDS_INFO") && (
            <div className="mt-5 border-t border-border pt-4">
              <CancelBookingButton reference={booking.reference} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
