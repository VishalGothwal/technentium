"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Accessible modal built on the native <dialog> element (focus trap, Esc to close, inert background).
 * Controlled via `open`; closing by Esc or backdrop calls `onClose`.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-[var(--radius)] border border-border bg-surface p-0 text-foreground shadow-xl",
        className,
      )}
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <h2 id="dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          <div className="mt-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
