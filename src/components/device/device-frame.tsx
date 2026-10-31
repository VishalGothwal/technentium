import type { DeviceKind } from "@/lib/customization/style";
import { frameFor, frontLayout, type ModuleShape } from "@/lib/device-frames";
import { cn } from "@/lib/cn";

/**
 * Line drawing of a specific device (its real camera layout), in `currentColor`. Pure SVG, server or client.
 * Used for thumbnails in device pickers, repair model pages and protection "fits your device" blocks.
 * The skin studio uses the filled `DevicePreview` instead.
 */
export function DeviceFrame({
  frame,
  kind = "phone",
  view = "back",
  label,
  className,
}: {
  frame?: string | null;
  kind?: DeviceKind;
  view?: "back" | "front";
  /** Accessible name; omit for a decorative drawing next to a text label. */
  label?: string;
  className?: string;
}) {
  const g = frameFor(frame, kind);
  const pad = 6;
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };

  return (
    <svg viewBox={`${-pad} ${-pad} ${g.w + pad * 2} ${g.h + pad * 2}`} className={cn("h-auto", className)} {...a11y}>
      <rect width={g.w} height={g.h} rx={g.r} {...STROKE} />
      {view === "front" ? <Front frame={frame} kind={kind} /> : <Back frame={frame} kind={kind} />}
    </svg>
  );
}

/** Thin outline that stays 1.6px at any rendered size. */
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, vectorEffect: "non-scaling-stroke" } as const;

type Paint = { fill?: string; fillOpacity?: number; stroke?: string; strokeWidth?: number; vectorEffect?: "non-scaling-stroke" };

function Shape({ s, ...props }: { s: ModuleShape } & Paint) {
  return s.shape === "rect" ? <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} {...props} /> : <circle cx={s.cx} cy={s.cy} r={s.r} {...props} />;
}

function Back({ frame, kind }: { frame?: string | null; kind: DeviceKind }) {
  const g = frameFor(frame, kind);
  return (
    <>
      {g.cover && <rect x={g.cover.x} y={g.cover.y} width={g.cover.w} height={g.cover.h} rx={g.cover.r} fill="currentColor" fillOpacity={0.12} />}
      {g.hinge && <line x1={0} x2={g.w} y1={g.hinge} y2={g.hinge} {...STROKE} strokeDasharray="4 4" />}
      {g.modules.map((m, i) => (
        <Shape key={i} s={m} {...STROKE} />
      ))}
      {g.lenses.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} {...STROKE} />
          <circle cx={x} cy={y} r={r * 0.45} fill="currentColor" />
        </g>
      ))}
      {g.flash.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="currentColor" fillOpacity={0.45} />
      ))}
      {g.logo && <circle cx={g.logo[0]} cy={g.logo[1]} r={g.logo[2]} {...STROKE} />}
    </>
  );
}

function Front({ frame, kind }: { frame?: string | null; kind: DeviceKind }) {
  const { screen, cutouts } = frontLayout(frameFor(frame, kind));
  return (
    <>
      <rect x={screen.x} y={screen.y} width={screen.w} height={screen.h} rx={screen.r} fill="currentColor" fillOpacity={0.1} />
      {cutouts.map((c, i) => (
        <Shape key={i} s={c} fill="currentColor" />
      ))}
    </>
  );
}
