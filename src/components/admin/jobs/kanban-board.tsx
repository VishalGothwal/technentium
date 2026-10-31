"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { JobStatus } from "@/generated/prisma/enums";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { Alert, Badge } from "@/components/ui/surface";
import { transitionJobAction } from "@/app/admin/actions";
import { ReasonDialog } from "./reason-dialog";

export type BoardCard = {
  id: string;
  reference: string;
  status: JobStatus;
  device: string;
  customer: string;
  ageDays: number;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  technician: string | null;
  targets: JobStatus[];
  reasonRequired: JobStatus[];
};

const COLUMNS: JobStatus[] = [
  "AWAITING_HANDOVER",
  "DEVICE_RECEIVED",
  "INSPECTION",
  "QUOTE_PREPARED",
  "AWAITING_DECISION",
  "AWAITING_CUSTOMER_RESPONSE",
  "APPROVED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "QUOTE_DECLINED",
  "RETURN_COORDINATION",
  "READY_FOR_RETURN",
  "ON_HOLD",
];

const PRIORITY_TONE = { LOW: "neutral", NORMAL: "neutral", HIGH: "warning", URGENT: "danger" } as const;

/**
 * Kanban with native drag-and-drop and a keyboard/screen-reader fallback (“Move to…” select).
 * Only targets the server says this actor may use are offered; the server re-validates every move.
 * A failed move puts the card back where it was and shows the reason.
 */
export function KanbanBoard({ cards: initial }: { cards: BoardCard[] }) {
  const { t } = useI18n();
  const [cards, setCards] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<JobStatus | null>(null);
  const [reasonFor, setReasonFor] = useState<{ card: BoardCard; to: JobStatus } | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // A successful move refreshes the route, which delivers fresh server-computed cards.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setCards(initial);
  }

  const label = (s: JobStatus) => t(`status.job.${s}`);

  function move(card: BoardCard, to: JobStatus, reason?: string) {
    if (to === card.status) return;
    if (!card.targets.includes(to)) {
      setNotice(`${card.reference} can't move from “${label(card.status)}” to “${label(to)}”.`);
      return;
    }
    if (card.reasonRequired.includes(to) && !reason) {
      setReasonError(null);
      setReasonFor({ card, to });
      return;
    }
    setNotice(null);
    const before = cards;
    setCards(cards.map((c) => (c.id === card.id ? { ...c, status: to, targets: [] } : c)));
    start(async () => {
      const res = await transitionJobAction(card.id, to, reason);
      if (res.ok) {
        setReasonFor(null);
        setNotice(null);
        return;
      }
      setCards(before);
      const message = t(res.fields?.reason ?? res.messageKey);
      if (reason) setReasonError(message);
      else setNotice(`${card.reference}: ${message}`);
    });
  }

  const draggedCard = dragging ? cards.find((c) => c.id === dragging) : null;
  const columns = COLUMNS.filter((s) => s !== "QUOTE_DECLINED" || cards.some((c) => c.status === s));

  return (
    <>
      <div aria-live="polite">
        {notice && (
          <Alert tone="danger" className="mb-3">
            {notice}
          </Alert>
        )}
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        <div className="flex gap-3">
          {columns.map((status) => {
            const list = cards.filter((c) => c.status === status);
            const canDrop = !!draggedCard && draggedCard.targets.includes(status);
            return (
              <section
                key={status}
                aria-label={label(status)}
                onDragOver={(e) => {
                  if (!canDrop) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverColumn(status);
                }}
                onDragLeave={() => setOverColumn((c) => (c === status ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverColumn(null);
                  const card = cards.find((c) => c.id === e.dataTransfer.getData("text/plain"));
                  if (card) move(card, status);
                }}
                className={cn(
                  "flex w-64 shrink-0 flex-col rounded-[var(--radius)] border bg-surface-muted/60 transition-colors",
                  canDrop ? "border-primary/60 border-dashed" : "border-border",
                  overColumn === status && "bg-primary-soft",
                  draggedCard && !canDrop && draggedCard.status !== status && "opacity-50",
                )}
              >
                <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <h2 className="text-sm font-semibold">{label(status)}</h2>
                  <span className="rounded-full bg-surface px-2 text-xs tabular-nums text-muted">{list.length}</span>
                </header>
                <ul className="flex min-h-24 flex-col gap-2 p-2">
                  {list.map((card) => (
                    <li
                      key={card.id}
                      draggable={card.targets.length > 0 && !pending}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", card.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragging(card.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOverColumn(null);
                      }}
                      className={cn("rounded-lg border border-border bg-surface p-3 text-sm shadow-sm", card.targets.length > 0 && "cursor-grab active:cursor-grabbing")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/admin/jobs/${card.id}`} className="font-medium text-primary hover:underline">
                          {card.reference}
                        </Link>
                        {card.priority !== "NORMAL" && <Badge tone={PRIORITY_TONE[card.priority]}>{card.priority.toLowerCase()}</Badge>}
                      </div>
                      <p className="mt-1">{card.device}</p>
                      <p className="text-muted">{card.customer}</p>
                      <p className="mt-1 text-xs text-muted">
                        {card.ageDays === 0 ? "Today" : `${card.ageDays}d old`} · {card.technician ?? "Unassigned"}
                      </p>
                      {card.targets.length > 0 && (
                        <label className="mt-2 block">
                          <span className="sr-only">Move {card.reference} to</span>
                          <select
                            value=""
                            onChange={(e) => e.target.value && move(card, e.target.value as JobStatus)}
                            className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs"
                            disabled={pending}
                          >
                            <option value="">Move to…</option>
                            {card.targets.map((to) => (
                              <option key={to} value={to}>
                                {label(to)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </li>
                  ))}
                  {list.length === 0 && <li className="px-1 py-4 text-center text-xs text-muted">No jobs</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Quote stages (prepared, awaiting decision, approved, declined) change automatically when a quote is prepared, sent or decided — open the job to manage its quote.
      </p>

      <ReasonDialog
        key={reasonFor ? `${reasonFor.card.id}-${reasonFor.to}` : "none"}
        open={!!reasonFor}
        title={reasonFor ? `Move ${reasonFor.card.reference} to “${label(reasonFor.to)}”` : ""}
        pending={pending}
        error={reasonError}
        onCancel={() => setReasonFor(null)}
        onConfirm={(reason) => reasonFor && move(reasonFor.card, reasonFor.to, reason)}
      />
    </>
  );
}
