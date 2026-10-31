import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/cn";

/** Per-topic palette for generated covers (used until editors upload real cover images). */
const PALETTES: Record<string, [string, string, string]> = {
  "repair-guides": ["#0f766e", "#14b8a6", "#ccfbf1"],
  "buying-guides": ["#1e3a8a", "#6366f1", "#e0e7ff"],
  protection: ["#065f46", "#0ea5e9", "#d1fae5"],
  tips: ["#9a3412", "#f59e0b", "#fef3c7"],
  news: ["#9f1239", "#f43f5e", "#ffe4e6"],
  specs: ["#111827", "#475569", "#e2e8f0"],
};

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
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
      <g transform={`translate(270 40) rotate(${tilt} 45 75)`} opacity="0.9">
        <rect width="90" height="160" rx="16" fill="none" stroke={light} strokeWidth="5" />
        <rect x="32" y="10" width="26" height="6" rx="3" fill={light} opacity="0.7" />
        <path d="M14 120 L76 120" stroke={light} strokeWidth="4" strokeLinecap="round" opacity="0.5" />
        <path d="M14 134 L56 134" stroke={light} strokeWidth="4" strokeLinecap="round" opacity="0.35" />
      </g>
      <path d={`M0 ${190 - (h % 30)} C 120 ${160 + (h % 40)}, 220 ${225 - (h % 20)}, 400 ${170 + (h % 30)} L400 225 L0 225 Z`} fill={dark} opacity="0.35" />
    </svg>
  );
}
