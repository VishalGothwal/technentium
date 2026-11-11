"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import type { DeviceKind } from "@/lib/customization/style";
import { resolveDevice3d, type Device3DRow, type Device3DSpec } from "@/lib/device-3d";
import { Device3D, type Device3DProps } from "./device-3d";

/**
 * 3D device with a Front/Back switch and a "drag to rotate" hint. Pass either a resolved `spec` or the
 * device's `frame` + `model3d` row. Used on repair model pages, account design pages and in the admin.
 */
export function DeviceViewer({
  kind,
  spec,
  frame,
  model3d,
  initialView = "front",
  label,
  className,
  dark = false,
  compact = false,
  ...skin
}: Omit<Device3DProps, "spec" | "view"> & {
  spec?: Device3DSpec;
  frame?: string | null;
  model3d?: Device3DRow;
  initialView?: "back" | "front";
  /** Light text for dark backgrounds. */
  dark?: boolean;
  /** Small boxes: no hint text, switch centred. */
  compact?: boolean;
  kind: DeviceKind;
}) {
  const { t } = useI18n();
  const [view, setView] = useState(initialView);
  const resolved = spec ?? resolveDevice3d(frame, model3d, kind);
  return (
    <div className={cn("relative", className)}>
      <Device3D kind={kind} spec={resolved} view={view} label={label} className="h-full w-full" {...skin} />
      <div className={cn("pointer-events-none absolute inset-x-2 bottom-2 flex items-center gap-2", compact ? "justify-center" : "justify-between")}>
        <span hidden={compact} className={cn("text-[0.7rem]", dark ? "text-white/60" : "text-muted")}>{t("studio.preview.rotateHint")}</span>
        {kind !== "laptop" && (
          <div role="group" aria-label={t("studio.preview.side")} className={cn("pointer-events-auto flex rounded-full p-0.5 text-xs font-semibold", dark ? "bg-white/10" : "bg-surface-muted")}>
            {(["front", "back"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn("rounded-full px-2.5 py-0.5 transition", view === v ? (dark ? "bg-white text-black" : "bg-surface text-foreground shadow-sm") : dark ? "text-white/70 hover:text-white" : "text-muted hover:text-foreground")}
              >
                {t(`studio.preview.${v}`)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
