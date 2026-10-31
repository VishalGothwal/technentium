import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Dark "studio" palette scoped to the customization section by overriding the design tokens on a
 * subtree (the shared components keep working). Primary is a light violet with dark text so both
 * buttons and accent text keep ≥ 4.5:1 contrast on the dark surfaces.
 */
export const STUDIO_VARS = {
  "--background": "#0b0c14",
  "--surface": "#141627",
  "--surface-muted": "#1c1f35",
  "--foreground": "#f4f4fb",
  "--muted": "#aeb2cb",
  "--border": "#2e3252",
  "--primary": "#c4b5fd",
  "--primary-hover": "#ddd6fe",
  "--primary-foreground": "#1a1033",
  "--primary-soft": "#2a2352",
  "--accent": "#f0abfc",
  "--danger": "#fca5a5",
  "--danger-soft": "#3b1518",
  "--warning": "#fcd34d",
  "--warning-soft": "#3a2a0a",
  "--success": "#86efac",
  "--success-soft": "#0f2e1c",
  "--info": "#93c5fd",
  "--info-soft": "#132544",
  "--focus": "#f0abfc",
  colorScheme: "dark",
} as CSSProperties;

export function StudioTheme({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div style={STUDIO_VARS} className={cn("bg-background text-foreground", className)}>
      {children}
    </div>
  );
}

/** Soft glowing backdrop used behind hero previews (decorative). */
export function Glow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute -top-24 left-1/4 size-80 rounded-full bg-fuchsia-500/25 blur-3xl" />
      <div className="absolute top-1/3 right-0 size-96 rounded-full bg-violet-600/25 blur-3xl" />
      <div className="absolute bottom-0 left-0 size-72 rounded-full bg-cyan-400/15 blur-3xl" />
    </div>
  );
}
