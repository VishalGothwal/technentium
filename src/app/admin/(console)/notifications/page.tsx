import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { DELIVERY_STATUSES, listDeliveries } from "@/server/modules/notifications/notification-log.service";
import { CHANNELS } from "@/server/notifications/matrix";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { Pagination, pageParam, strParam } from "@/components/admin/pagination";
import { RetryDeliveryButton } from "./retry-button";

import { NoAccess } from "@/components/admin/no-access";

export const metadata = { title: "Notification log" };
export const instant = false;

const TONE = { SENT: "success", FAILED: "danger", PENDING: "info", SKIPPED: "neutral" } as const;

export default async function NotificationLogPage({ searchParams }: PageProps<"/admin/notifications">) {
  const actor = await requireStaffPage();
  if (!can(actor, "notification.view_log")) return <NoAccess />;
  const sp = await searchParams;
  const status = strParam(sp.status);
  const channel = strParam(sp.channel);
  const page = pageParam(sp.page);
  const { items, total, pageSize, names } = await listDeliveries(actor, { status, channel, page });

  return (
    <>
      <PageHeader
        title="Notification log"
        description="Each customer message per channel. Failed deliveries are retried automatically with backoff; SMS and WhatsApp use console stubs until providers are chosen."
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className="h-10 rounded-lg border border-border bg-surface px-3 text-sm">
          <option value="">All statuses</option>
          {DELIVERY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="channel" defaultValue={channel ?? ""} aria-label="Channel" className="h-10 rounded-lg border border-border bg-surface px-3 text-sm">
          <option value="">All channels</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm" className="h-10">
          Filter
        </Button>
      </form>
      {items.length === 0 ? (
        <EmptyState title="No deliveries match" />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {items.map((d) => {
              const ref = (d.event.payload as { params?: Record<string, string> } | null)?.params?.reference;
              return (
                <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="font-mono text-xs">{d.event.type}</span> → {names[d.event.recipientId] ?? "Unknown"}
                      {ref && <span className="text-muted"> · {ref}</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {d.channel} · {d.provider ?? "—"} · {d.attempts} attempt{d.attempts === 1 ? "" : "s"} · {formatDateTime(d.createdAt)}
                      {d.sentAt && ` · sent ${formatDateTime(d.sentAt)}`}
                    </p>
                    {d.lastError && <p className="mt-1 break-words text-xs text-danger">{d.lastError}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={TONE[d.status]}>{d.status}</Badge>
                    {d.status === "FAILED" && <RetryDeliveryButton id={d.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/notifications" params={{ status, channel }} />
    </>
  );
}
