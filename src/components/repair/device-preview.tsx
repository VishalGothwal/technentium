"use client";
import dynamic from "next/dynamic";
import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { DeviceViewer as Viewer } from "@/components/device/device-viewer";

// The 3D engine is a separate chunk, fetched only when the visitor switches to 3D.
const DeviceViewer = dynamic(() => import("@/components/device/device-viewer").then((m) => m.DeviceViewer), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-xl bg-surface-muted" />,
});

/** Repair model preview: the flat (2D) picture by default, with a 2D / 3D switch. */
export function DevicePreview({ flat, className, ...viewer }: ComponentProps<typeof Viewer> & { flat: ReactNode }) {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  return (
    <div className={cn("relative shrink-0 rounded-xl bg-surface-muted", className)}>
      {mode === "3d" ? <DeviceViewer {...viewer} compact className="size-full rounded-xl" /> : <div className="flex size-full items-center justify-center p-3">{flat}</div>}
      <div role="group" className="absolute top-2 left-2 z-10 flex gap-0.5 rounded-full bg-surface p-0.5 shadow-sm">
        {(["2d", "3d"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={cn("rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold uppercase transition", mode === m ? "bg-foreground text-white" : "text-muted hover:text-foreground")}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
