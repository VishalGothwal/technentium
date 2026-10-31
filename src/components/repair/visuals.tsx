import { cn } from "@/lib/cn";

/**
 * Line icons for repair services and devices. Decorative (aria-hidden) — a text label always sits next to them.
 * Icons are picked from keywords in the issue slug so new issue types get a sensible icon without code changes.
 */

type IconKind = "screen" | "battery" | "port" | "camera" | "audio" | "water" | "back" | "software" | "keyboard" | "strap" | "bud" | "case" | "other";

const RULES: [RegExp, IconKind][] = [
  [/screen|display/, "screen"],
  [/charging-port|port/, "port"],
  [/charging-case/, "case"],
  [/battery|charging/, "battery"],
  [/camera|lens/, "camera"],
  [/speaker|microphone|mic|receiver/, "audio"],
  [/water|liquid/, "water"],
  [/back-glass|back-panel/, "back"],
  [/software|slow|not-turning-on/, "software"],
  [/keyboard|trackpad/, "keyboard"],
  [/strap|button/, "strap"],
  [/one-side/, "bud"],
];

export const issueIconKind = (slug: string): IconKind => RULES.find(([re]) => re.test(slug))?.[1] ?? "other";

export function IssueIcon({ slug, className }: { slug: string; className?: string }) {
  const kind = issueIconKind(slug);
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("size-12", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[kind]}
    </svg>
  );
}

const fill = "var(--primary)";
const ICONS: Record<IconKind, React.ReactNode> = {
  screen: (
    <>
      <rect x="13" y="4" width="22" height="40" rx="4" />
      <path d="M17 10h14v26H17z" fill={fill} fillOpacity=".25" />
      <path d="M17 14l7 6-3 6 8 4M24 20l7-4M21 26l-4 4" />
      <path d="M22 40h4" />
    </>
  ),
  battery: (
    <>
      <rect x="15" y="8" width="18" height="36" rx="3" />
      <path d="M20 4h8v4h-8z" />
      <path d="M26 15l-6 10h7l-5 10" stroke={fill} strokeWidth="2.5" />
    </>
  ),
  port: (
    <>
      <path d="M16 30l-8 8M10 32l6 6" />
      <rect x="18" y="12" width="14" height="22" rx="3" transform="rotate(45 25 23)" />
      <path d="M31 9l4-4M37 15l4-4" />
      <path d="M26 20l-4 5h4l-3 4" stroke={fill} strokeWidth="2.5" />
    </>
  ),
  camera: (
    <>
      <path d="M6 16a3 3 0 0 1 3-3h6l3-4h12l3 4h6a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" />
      <circle cx="24" cy="26" r="8" />
      <circle cx="24" cy="26" r="4" fill={fill} fillOpacity=".5" />
      <circle cx="36" cy="18" r="1" fill="currentColor" />
    </>
  ),
  audio: (
    <>
      <rect x="18" y="5" width="12" height="22" rx="6" fill={fill} fillOpacity=".25" />
      <path d="M22 11h4M22 16h4M22 21h4" />
      <path d="M12 23a12 12 0 0 0 24 0M24 35v7M17 43h14" />
    </>
  ),
  water: (
    <>
      <rect x="10" y="4" width="20" height="36" rx="4" />
      <path d="M36 24c0 0-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z" fill={fill} fillOpacity=".35" />
      <path d="M18 34h4" />
    </>
  ),
  back: (
    <>
      <rect x="13" y="4" width="22" height="40" rx="4" />
      <rect x="17" y="8" width="9" height="12" rx="3" fill={fill} fillOpacity=".25" />
      <circle cx="21.5" cy="12" r="2" />
      <path d="M27 26l4 4-3 5 4 5" />
    </>
  ),
  software: (
    <>
      <rect x="13" y="4" width="22" height="40" rx="4" />
      <circle cx="24" cy="23" r="6" fill={fill} fillOpacity=".25" />
      <path d="M24 13v3M24 30v3M14 23h3M31 23h3M17 16l2 2M29 28l2 2M31 16l-2 2M19 28l-2 2" />
    </>
  ),
  keyboard: (
    <>
      <rect x="4" y="14" width="40" height="22" rx="3" />
      <path d="M10 20h2M16 20h2M22 20h2M28 20h2M34 20h4M10 25h4M18 25h2M24 25h2M30 25h2M36 25h2" />
      <path d="M15 30h18" stroke={fill} strokeWidth="2.5" />
    </>
  ),
  strap: (
    <>
      <path d="M17 4h14l2 10M17 4l-2 10M17 44h14l2-10M17 44l-2-10" />
      <rect x="13" y="14" width="22" height="20" rx="5" fill={fill} fillOpacity=".25" />
      <path d="M35 21h3v6h-3" />
    </>
  ),
  bud: (
    <>
      <path d="M14 10a8 8 0 0 1 8 8v4a6 6 0 0 1-6 6h0v12a3 3 0 0 1-6 0V18a8 8 0 0 1 4-8z" fill={fill} fillOpacity=".25" />
      <path d="M30 18l8-4M30 24h9M30 30l8 4" />
    </>
  ),
  case: (
    <>
      <rect x="8" y="16" width="32" height="24" rx="12" />
      <path d="M8 26h32" />
      <circle cx="24" cy="33" r="1.5" fill={fill} stroke="none" />
      <path d="M24 6v6M20 8l4 4 4-4" stroke={fill} />
    </>
  ),
  other: (
    <>
      <path d="M30 6a8 8 0 0 0-9 11L8 30a3 3 0 0 0 4 4l13-13a8 8 0 0 0 11-9l-5 5-4-1-1-4z" fill={fill} fillOpacity=".25" />
      <path d="M28 30l12 12M34 28l-6 6" />
    </>
  ),
};

/** Generic device drawing for a category, used in place of model photos. */
export function DeviceArt({ category, className }: { category: string; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-16", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      {category === "laptop" ? (
        <>
          <rect x="12" y="14" width="40" height="26" rx="2" />
          <rect x="15" y="17" width="34" height="20" fill={fill} fillOpacity=".18" stroke="none" />
          <path d="M6 44h52l-4 4H10z" />
        </>
      ) : category === "tablet" ? (
        <>
          <rect x="12" y="6" width="40" height="52" rx="5" />
          <rect x="16" y="11" width="32" height="40" rx="1" fill={fill} fillOpacity=".18" stroke="none" />
          <circle cx="32" cy="54.5" r="1.3" fill="currentColor" />
        </>
      ) : category === "smartwatch" ? (
        <>
          <path d="M24 4h16l2 12M24 4l-2 12M24 60h16l2-12M24 60l-2-12" />
          <rect x="18" y="16" width="28" height="32" rx="8" />
          <rect x="22" y="20" width="20" height="24" rx="5" fill={fill} fillOpacity=".18" stroke="none" />
          <path d="M46 28h3v6h-3" />
        </>
      ) : category === "audio" ? (
        <>
          <rect x="12" y="24" width="40" height="30" rx="14" />
          <path d="M12 37h40" />
          <path d="M22 8a6 6 0 0 1 6 6v4a5 5 0 0 1-5 5h0v6" fill={fill} fillOpacity=".18" />
          <path d="M42 8a6 6 0 0 0-6 6v4a5 5 0 0 0 5 5h0v6" fill={fill} fillOpacity=".18" />
        </>
      ) : (
        <>
          <rect x="18" y="4" width="28" height="56" rx="6" />
          <rect x="21" y="10" width="22" height="42" rx="2" fill={fill} fillOpacity=".18" stroke="none" />
          <path d="M28 7h8" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
