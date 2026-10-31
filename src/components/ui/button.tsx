import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        /** White button for dark (black) sections, where `primary` would vanish. */
        inverse: "bg-white text-black hover:bg-white/85",
        secondary: "border border-border bg-surface text-foreground hover:bg-surface-muted",
        ghost: "text-foreground hover:bg-surface-muted",
        danger: "bg-danger text-white hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline px-0",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Variants = VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, block, pending, children, disabled, ...props }: ComponentProps<"button"> & Variants & { pending?: boolean }) {
  return (
    <button className={cn(buttonStyles({ variant, size, block }), className)} disabled={disabled || pending} aria-busy={pending || undefined} {...props}>
      {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({ className, variant, size, block, ...props }: ComponentProps<typeof Link> & Variants) {
  return <Link className={cn(buttonStyles({ variant, size, block }), className)} {...props} />;
}
