import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/cn";

/** Per-topic palette for generated covers (used until editors upload real cover images). */
const PALETTES: Record<string, [string, string, string]> = {
  "repair-guides": ["#0f766e", "#14b8a6", "#ccfbf1"],
  "buying-guides": ["#1e3a8a", "#6366f1", "#e0e7ff"],
  protection: ["#065f46", "#0ea5e9", "#d1fae5"],
  tips: ["#9a3412", "#f59e0b", "#fef3c7"],
  news: ["#9f1239", "#f43f5e", "#ffe4e6"],
  "software-apps": ["#3730a3", "#8b5cf6", "#ede9fe"],
  photography: ["#78350f", "#f97316", "#ffedd5"],
  gaming: ["#14532d", "#22c55e", "#dcfce7"],
  "laptops-tablets": ["#334155", "#64748b", "#f1f5f9"],
  accessories: ["#831843", "#ec4899", "#fce7f3"],
  specs: ["#111827", "#475569", "#e2e8f0"],
};

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

type IconKind = "phone" | "battery" | "charger" | "camera" | "gamepad" | "laptop" | "tablet" | "earbuds" | "watch" | "shield" | "crack" | "water" | "wrench" | "news" | "chip" | "lock" | "travel" | "sparkle";

/** Keyword → icon, checked against the article slug first, then the topic's default. */
const ICON_RULES: [RegExp, IconKind][] = [
  [/batter|charging-habit|optimi[sz]ed-charg/, "battery"],
  [/charger|cable|power-bank|powerbank|magsafe|qi2|bis/, "charger"],
  [/camera|photo|night|lens|video/, "camera"],
  [/gam(e|ing)|throttl|fps/, "gamepad"],
  [/laptop|macbook/, "laptop"],
  [/tablet|ipad/, "tablet"],
  [/earbud|airpod|buds|headphone/, "earbuds"],
  [/watch|strap/, "watch"],
  [/scam|fake-app|secur|privacy|upi|lock/, "lock"],
  [/crack|back-glass|screen-protector|tempered|glass|ghost-touch|green-line/, "crack"],
  [/water|monsoon|humid|dust|rain/, "water"],
  [/boot-loop|update|software|storage|android|ios|app/, "chip"],
  [/travel|trip/, "travel"],
  [/case|protect|skin|fold/, "shield"],
  [/repair|fix|diagnos|not-charging|overheat|speaker|mic/, "wrench"],
];
const TOPIC_ICON: Record<string, IconKind> = {
  "repair-guides": "wrench",
  "buying-guides": "sparkle",
  protection: "shield",
  tips: "sparkle",
  news: "news",
  "software-apps": "chip",
  photography: "camera",
  gaming: "gamepad",
  "laptops-tablets": "laptop",
  accessories: "earbuds",
};
export const coverIconFor = (slug: string, topic: string): IconKind => ICON_RULES.find(([re]) => re.test(slug))?.[1] ?? TOPIC_ICON[topic] ?? "phone";

/** Line icons drawn in a 120 × 150 box, stroke inherited from the parent group. */
function CoverIcon({ kind, light }: { kind: IconKind; light: string }) {
  const dot = { fill: light, stroke: "none" } as const;
  switch (kind) {
    case "battery":
      return (
        <>
          <rect x="25" y="20" width="70" height="125" rx="14" />
          <rect x="45" y="8" width="30" height="12" rx="4" />
          <path d="M64 48 L46 86 H64 L56 120 L78 76 H60 Z" fill={light} fillOpacity="0.5" />
        </>
      );
    case "charger":
      return (
        <>
          <rect x="20" y="40" width="80" height="70" rx="16" />
          <path d="M45 40 V18 M75 40 V18" />
          <path d="M60 110 V128 C60 140 80 140 90 140" />
          <path d="M62 58 L52 78 H64 L58 94" strokeWidth="4" />
        </>
      );
    case "camera":
      return (
        <>
          <path d="M8 50 a10 10 0 0 1 10 -10 h18 l10 -14 h28 l10 14 h18 a10 10 0 0 1 10 10 v62 a10 10 0 0 1 -10 10 h-84 a10 10 0 0 1 -10 -10 z" />
          <circle cx="60" cy="80" r="24" />
          <circle cx="60" cy="80" r="11" fill={light} fillOpacity="0.4" />
          <circle cx="96" cy="56" r="3" {...dot} />
        </>
      );
    case "gamepad":
      return (
        <>
          <path d="M30 50 h60 a28 28 0 0 1 27 34 l-6 28 a14 14 0 0 1 -24 6 l-12 -14 h-30 l-12 14 a14 14 0 0 1 -24 -6 l-6 -28 a28 28 0 0 1 27 -34 z" />
          <path d="M34 72 v20 M24 82 h20" />
          <circle cx="84" cy="76" r="4" {...dot} />
          <circle cx="96" cy="88" r="4" {...dot} />
        </>
      );
    case "laptop":
      return (
        <>
          <rect x="18" y="35" width="84" height="60" rx="6" />
          <path d="M4 112 h112 l-8 12 h-96 z" />
          <path d="M32 80 h30" strokeWidth="4" opacity="0.6" />
        </>
      );
    case "tablet":
      return (
        <>
          <rect x="15" y="12" width="90" height="128" rx="12" />
          <circle cx="60" cy="24" r="3" {...dot} />
          <path d="M30 110 h50 M30 122 h34" strokeWidth="4" opacity="0.6" />
        </>
      );
    case "earbuds":
      return (
        <>
          <path d="M34 40 a18 18 0 0 1 18 18 v44 a8 8 0 0 1 -16 0 v-28 a18 18 0 0 1 -2 -34 z" />
          <path d="M86 40 a18 18 0 0 0 -18 18 v44 a8 8 0 0 0 16 0 v-28 a18 18 0 0 0 2 -34 z" />
          <rect x="20" y="118" width="80" height="28" rx="14" />
        </>
      );
    case "watch":
      return (
        <>
          <path d="M40 30 L46 6 h28 l6 24 M40 120 L46 144 h28 l6 -24" />
          <rect x="28" y="30" width="64" height="90" rx="18" />
          <path d="M60 58 v18 l12 8" />
        </>
      );
    case "shield":
      return (
        <>
          <path d="M60 10 L104 28 V72 C104 106 84 128 60 140 C36 128 16 106 16 72 V28 Z" />
          <path d="M40 74 L55 89 L82 60" />
        </>
      );
    case "lock":
      return (
        <>
          <rect x="18" y="64" width="84" height="74" rx="12" />
          <path d="M36 64 V44 a24 24 0 0 1 48 0 V64" />
          <circle cx="60" cy="96" r="7" {...dot} />
          <path d="M60 103 v14" />
        </>
      );
    case "crack":
      return (
        <>
          <rect x="15" y="0" width="90" height="150" rx="16" />
          <path d="M48 0 L56 40 L40 62 L64 86 L52 112 L70 150" strokeWidth="4" />
          <path d="M56 40 L84 48 M64 86 L92 92" strokeWidth="3" opacity="0.7" />
        </>
      );
    case "water":
      return (
        <>
          <path d="M60 10 C60 10 22 60 22 92 a38 38 0 0 0 76 0 C98 60 60 10 60 10 z" />
          <path d="M42 96 a18 18 0 0 0 18 18" opacity="0.7" />
        </>
      );
    case "wrench":
      return (
        <>
          <path d="M84 16 a30 30 0 0 0 -38 38 L14 86 a12 12 0 0 0 17 17 L63 71 a30 30 0 0 0 38 -38 l-17 17 l-14 -4 l-4 -14 z" />
          <circle cx="22" cy="95" r="3" {...dot} />
        </>
      );
    case "news":
      return (
        <>
          <rect x="10" y="22" width="92" height="112" rx="8" />
          <path d="M102 50 h10 v76 a8 8 0 0 1 -8 8" />
          <rect x="24" y="38" width="40" height="30" rx="4" fill={light} fillOpacity="0.35" />
          <path d="M74 42 h16 M74 56 h16 M24 84 h66 M24 100 h66 M24 116 h46" strokeWidth="4" opacity="0.7" />
        </>
      );
    case "chip":
      return (
        <>
          <rect x="28" y="40" width="64" height="64" rx="10" />
          <rect x="44" y="56" width="32" height="32" rx="4" fill={light} fillOpacity="0.35" />
          <path d="M44 40 V24 M60 40 V24 M76 40 V24 M44 104 V120 M60 104 V120 M76 104 V120 M28 56 H12 M28 72 H12 M28 88 H12 M92 56 H108 M92 72 H108 M92 88 H108" strokeWidth="4" />
        </>
      );
    case "travel":
      return (
        <>
          <rect x="16" y="46" width="88" height="88" rx="12" />
          <path d="M42 46 V30 a8 8 0 0 1 8 -8 h20 a8 8 0 0 1 8 8 V46" />
          <path d="M16 80 h88" opacity="0.7" />
          <rect x="52" y="72" width="16" height="16" rx="3" fill={light} fillOpacity="0.5" />
        </>
      );
    case "sparkle":
      return (
        <>
          <rect x="15" y="0" width="90" height="150" rx="16" />
          <path d="M60 46 C62 64 68 70 86 72 C68 74 62 80 60 98 C58 80 52 74 34 72 C52 70 58 64 60 46 Z" fill={light} fillOpacity="0.45" />
          <path d="M44 14 h32" strokeWidth="4" opacity="0.7" />
        </>
      );
    default:
      return (
        <>
          <rect x="15" y="0" width="90" height="150" rx="16" />
          <rect x="47" y="10" width="26" height="6" rx="3" fill={light} opacity="0.7" />
          <path d="M29 110 L91 110" strokeWidth="4" opacity="0.5" />
          <path d="M29 124 L71 124" strokeWidth="4" opacity="0.35" />
        </>
      );
  }
}

/**
 * Cover image, or a calm generated illustration (topic gradient + device outline + soft shapes)
 * seeded by the slug so every article gets a stable, distinct cover.
 */
export function CoverArt({ topic, seed, mediaId, alt = "", className, eager }: { topic: string; seed: string; mediaId?: string | null; alt?: string; className?: string; eager?: boolean }) {
  if (mediaId) {
    // eslint-disable-next-line @next/next/no-img-element -- served by the authorising media route, already re-encoded to WebP
    return <img src={mediaUrl(mediaId)} alt={alt} loading={eager ? "eager" : "lazy"} className={cn("size-full object-cover", className)} />;
  }
  const [dark, mid, light] = PALETTES[topic] ?? PALETTES["tips"]!;
  const h = hash(seed);
  const cx = 60 + (h % 180);
  const cy = 20 + ((h >> 8) % 120);
  const r = 70 + ((h >> 16) % 60);
  const tilt = ((h >> 4) % 24) - 12;
  const id = `g${h.toString(36)}`;
  return (
    <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" role="img" aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={cn("size-full", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={dark} />
          <stop offset="1" stopColor={mid} />
        </linearGradient>
      </defs>
      <rect width="400" height="225" fill={`url(#${id})`} />
      <circle cx={cx} cy={cy} r={r} fill={light} opacity="0.18" />
      <circle cx={400 - cx / 2} cy={225 - cy / 3} r={r * 0.7} fill={light} opacity="0.12" />
      <g transform={`translate(255 38) rotate(${tilt} 60 75)`} opacity="0.92" fill="none" stroke={light} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <CoverIcon kind={coverIconFor(seed, topic)} light={light} />
      </g>
      <path d={`M0 ${190 - (h % 30)} C 120 ${160 + (h % 40)}, 220 ${225 - (h % 20)}, 400 ${170 + (h % 30)} L400 225 L0 225 Z`} fill={dark} opacity="0.35" />
    </svg>
  );
}
