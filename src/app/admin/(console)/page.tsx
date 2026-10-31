import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guards";
import { getDashboard } from "@/server/modules/dashboard/dashboard.service";
import { createT } from "@/i18n/translate";
import { cn } from "@/lib/cn";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/surface";
import { NavGlyph, type NavIcon } from "@/components/admin/nav-links";
import { JOB_TONE } from "@/components/repair/status";

export const metadata = { title: "Dashboard" };

const t = createT("en");

type Tone = "warning" | "danger";
const TONE_RING: Record<Tone, string> = { warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger" };

/** A queue count. Hidden when the viewer lacks access (null); highlighted when something needs attention. */
function Stat({ label, value, href, tone, icon }: { label: string; value: number | null; href: string; tone?: Tone; icon: NavIcon }) {
  if (value === null) return null;
  const hot = value > 0 && tone;
  return (
    <Link href={href} className="group flex flex-col rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(10,10,11,0.04)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <span className={cn("flex size-9 items-center justify-center rounded-lg", hot ? TONE_RING[tone] : "bg-primary-soft text-primary")}>
        <NavGlyph icon={icon} />
      </span>
      <span className={cn("mt-4 font-display text-4xl leading-none font-bold tabular-nums", hot && (tone === "danger" ? "text-danger" : "text-warning"))}>{value}</span>
      <span className="mt-1.5 flex items-center justify-between gap-2 text-sm text-muted">
        {label}
        <span aria-hidden className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100">
          →
        </span>
      </span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-3 text-[0.7rem] font-semibold tracking-[0.16em] text-muted uppercase first:mt-0">{children}</h2>;
}

/** Greeting by Indian Standard Time (the shop's timezone), whatever the server's clock. */
function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const actor = await requireStaffPage();
  const d = await getDashboard(actor);
  const jobStatuses = Object.entries(d.jobsByStatus).sort((a, b) => b[1] - a[1]);
  const activeJobs = jobStatuses.reduce((n, [, c]) => n + c, 0);
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date());
  const headline = [
    { label: "Bookings to confirm", value: d.awaitingConfirmation },
    { label: "Quotes awaiting decision", value: d.quotesAwaiting },
    { label: "Active repairs", value: activeJobs },
    { label: "Appointments today", value: d.todaysAppointments?.length ?? null },
  ].filter((h): h is { label: string; value: number } => h.value !== null);

  return (
    <>
      <h1 className="sr-only">Dashboard</h1>
      <section className="relative overflow-hidden rounded-2xl bg-black p-6 text-white sm:p-8">
        <div aria-hidden className="absolute -top-20 -right-10 size-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">{today}</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {greeting()}, {actor.name?.split(" ")[0] ?? "there"}
          </p>
          <p className="mt-1 text-sm text-white/70">Work awaiting action across repairs, orders, custom designs and content.</p>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {headline.map((h) => (
              <div key={h.label} className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/10 backdrop-blur">
                <dt className="text-xs text-white/70">{h.label}</dt>
                <dd className="mt-1 font-display text-3xl leading-none font-bold tabular-nums">{h.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mt-8">
        <SectionLabel>Repairs</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Bookings to confirm" value={d.awaitingConfirmation} href="/admin/bookings?status=SUBMITTED" tone="warning" icon="inbox" />
          <Stat label="Waiting on customer info" value={d.needsInfo} href="/admin/bookings?status=NEEDS_INFO" icon="users" />
          <Stat label="Quotes awaiting decision" value={d.quotesAwaiting} href="/admin/jobs?status=AWAITING_DECISION" icon="wrench" />
          <Stat label="Jobs awaiting return" value={d.awaitingReturn} href="/admin/jobs?status=READY_FOR_RETURN" icon="box" />
          <Stat label="Failed notifications" value={d.failedNotifications} href="/admin/notifications?status=FAILED" tone="danger" icon="bell" />
        </div>

        {(d.ordersToReview !== null || d.lowStock !== null || d.designsToReview !== null || d.contentDrafts !== null) && (
          <>
            <SectionLabel>Shop, designs &amp; content</SectionLabel>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Order requests to review" value={d.ordersToReview} href="/admin/orders?status=SUBMITTED" tone="warning" icon="bag" />
              <Stat label="Orders in fulfilment" value={d.ordersInFulfilment} href="/admin/orders?status=FULFILLING" icon="box" />
              <Stat label="Products at or below low stock" value={d.lowStock} href="/admin/products?stock=low" tone="danger" icon="chart" />
              <Stat label="Design requests to review" value={d.designsToReview} href="/admin/customization?status=SUBMITTED" tone="warning" icon="brush" />
              <Stat label="Design prices awaiting customer" value={d.designsQuoted} href="/admin/customization?status=QUOTE_SHARED" icon="palette" />
              <Stat label="Content drafts" value={d.contentDrafts} href="/admin/content?status=DRAFT" icon="article" />
              <Stat label="Scheduled to publish" value={d.contentScheduled} href="/admin/content?status=SCHEDULED" icon="history" />
            </div>
          </>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Active repairs by status"
            action={
              <Link href="/admin/jobs/board" className="text-sm font-medium text-primary hover:underline">
                Open board →
              </Link>
            }
          />
          <CardBody>
            {jobStatuses.length === 0 ? (
              <EmptyState title="No active repairs" />
            ) : (
              <ul className="space-y-2.5">
                {jobStatuses.map(([status, count]) => (
                  <li key={status}>
                    <Link href={`/admin/jobs?status=${status}`} className="group block rounded-lg px-2 py-1.5 hover:bg-surface-muted">
                      <span className="flex items-center justify-between gap-3">
                        <Badge tone={JOB_TONE[status]}>{t(`status.job.${status}`)}</Badge>
                        <span className="font-semibold tabular-nums">{count}</span>
                      </span>
                      <span aria-hidden className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-muted">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (count / activeJobs) * 100)}%` }} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {d.todaysAppointments && (
          <Card>
            <CardHeader title="Today's appointments" description="Bookings for today's slots not yet received." />
            <CardBody>
              {d.todaysAppointments.length === 0 ? (
                <EmptyState title="Nothing scheduled today" />
              ) : (
                <ol className="relative space-y-3 border-l border-border pl-5">
                  {d.todaysAppointments.map((a) => (
                    <li key={a.id} className="relative">
                      <span aria-hidden className={cn("absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full ring-4 ring-surface", a.status === "SUBMITTED" ? "bg-warning" : "bg-primary")} />
                      <div className="flex items-start justify-between gap-3 text-sm">
                        <Link href={a.job ? `/admin/jobs/${a.job.id}` : `/admin/bookings/${a.id}`} className="min-w-0 hover:underline">
                          <span className="block font-semibold tabular-nums">
                            {a.slot?.startTime}–{a.slot?.endTime}
                          </span>
                          <span className="text-muted">
                            {a.contactName} · {a.reference}
                          </span>
                        </Link>
                        <Badge tone={a.status === "SUBMITTED" ? "warning" : "primary"}>{a.status === "SUBMITTED" ? "Unconfirmed" : t(`handover.${a.handoverMethod}.title`)}</Badge>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
