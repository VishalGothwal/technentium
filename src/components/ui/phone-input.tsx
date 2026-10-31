"use client";
import { forwardRef, type ComponentProps } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNational, isCompleteNational, nationalDigits } from "@/lib/phone";

type Props = Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "size"> & {
  /** National digits only, e.g. "9876543210" (no +91, no spaces). */
  value: string;
  onChange: (digits: string) => void;
  /** Called once when the tenth valid digit is entered (e.g. to send the OTP or move focus on). */
  onComplete?: (digits: string) => void;
  size?: "md" | "lg";
};

/**
 * Indian mobile field: a fixed +91, the numeric keypad, digits only, "98765 43210" spacing as you type,
 * and pasted "+91…" / "0…" numbers cleaned up. Shows a tick when the number is complete.
 */
export const PhoneInput = forwardRef<HTMLInputElement, Props>(function PhoneInput({ value, onChange, onComplete, size = "md", className, ...props }, ref) {
  const digits = nationalDigits(value);
  const complete = isCompleteNational(digits);
  const badStart = digits.length > 0 && !/^[6-9]/.test(digits);
  return (
    <div
      className={cn(
        "flex w-full items-center overflow-hidden rounded-lg border bg-surface transition focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground",
        props["aria-invalid"] === true || props["aria-invalid"] === "true" || badStart ? "border-danger" : "border-border",
        size === "lg" ? "h-14" : "h-11",
        className,
      )}
    >
      <span aria-hidden className={cn("flex h-full shrink-0 items-center gap-1.5 border-r border-border bg-surface-muted px-3 font-semibold text-foreground", size === "lg" ? "text-lg" : "text-sm")}>
        <span className="text-base leading-none">🇮🇳</span>+91
      </span>
      <input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="98765 43210"
        // No maxLength: it would cut a pasted "+91 98765-43210" before it can be cleaned; nationalDigits caps at 10.
        {...props}
        value={formatNational(digits)}
        onChange={(e) => {
          const next = nationalDigits(e.target.value);
          onChange(next);
          if (onComplete && isCompleteNational(next) && !complete) onComplete(next);
        }}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent px-3 font-medium tracking-wider text-foreground outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-muted/60",
          size === "lg" ? "text-xl" : "text-base sm:text-sm",
        )}
      />
      <span aria-hidden className={cn("mr-3 flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-white transition", complete ? "scale-100 opacity-100" : "scale-50 opacity-0")}>
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    </div>
  );
});
