"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";

/**
 * Horizontal scroll-snap row with circular arrow buttons (shown from `sm` up, only when there is
 * more to scroll). Touch users swipe; the list itself stays a plain <ul> for assistive tech.
 */
export function Rail({ children, className, listClassName, label }: { children: ReactNode; className?: string; listClassName?: string; label?: string }) {
  const { t } = useI18n();
  const ref = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  const arrow = "absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-md transition hover:bg-foreground hover:text-white sm:flex";

  return (
    <div className={cn("relative", className)}>
      <ul ref={ref} aria-label={label} className={cn("flex snap-x snap-mandatory overflow-x-auto scrollbar-none", listClassName)}>
        {children}
      </ul>
      {!edge.start && (
        <button type="button" onClick={() => scroll(-1)} aria-label={t("shop.scrollBack")} className={cn(arrow, "left-1")}>
          <Chevron className="rotate-180" />
        </button>
      )}
      {!edge.end && (
        <button type="button" onClick={() => scroll(1)} aria-label={t("shop.scrollForward")} className={cn(arrow, "right-1")}>
          <Chevron />
        </button>
      )}
    </div>
  );
}

export function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
