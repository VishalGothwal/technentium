"use client";
import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-lg border border-border bg-surface px-3 text-base text-foreground placeholder:text-muted/70 disabled:bg-surface-muted aria-[invalid=true]:border-danger sm:text-sm";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-11 pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}

/**
 * Label + control + hint + error, wired with aria-describedby / aria-invalid.
 * `children` receives the generated id and aria props.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string; required?: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-danger" aria-hidden> *</span>}
      </Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined, required })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex items-start gap-3 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
