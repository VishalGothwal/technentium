import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/cn";

/**
 * Product image, or an illustration of its type (HD+, privacy, anti-yellow…) or category when no photo
 * has been uploaded yet.
 * Illustrations are decorative (aria-hidden) — the product name is always rendered next to them.
 */
const PALETTES: Record<string, [bg1: string, bg2: string, ink: string, accent: string]> = {
  "screen-protectors": ["#e3f5f2", "#c8ebe5", "#0f766e", "#5eead4"],
  "cases-covers": ["#e8ecfb", "#d3dbf6", "#1e3a8a", "#93c5fd"],
  "camera-protectors": ["#efe9fb", "#dfd3f5", "#5b21b6", "#c4b5fd"],
  "chargers-cables": ["#fdf2e1", "#f9e0bb", "#9a5b00", "#fbbf24"],
  "power-banks": ["#e5f5ea", "#c9ead4", "#12733f", "#86efac"],
  "earbud-cases": ["#fbe9f1", "#f5d0e1", "#9d174d", "#f9a8d4"],
  "cleaning-kits": ["#e4f2fb", "#c9e4f6", "#075985", "#7dd3fc"],
  "laptop-sleeves": ["#f1efeb", "#e2ddd4", "#57534e", "#d6c7a8"],
};
const DEFAULT_PALETTE: [string, string, string, string] = ["#eef1f5", "#dde3ea", "#14213d", "#94a3b8"];

export function ProductVisual({
  imageId,
  categorySlug,
  typeSlug,
  alt = "",
  className,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  priority,
}: {
  imageId: string | null;
  categorySlug: string;
  /** Product type slug; picks a type-specific drawing so e.g. privacy and HD+ glass look different. */
  typeSlug?: string | null;
  alt?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (imageId) {
    return (
      // Product photos are served through /api/v1/media with immutable caching.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={mediaUrl(imageId)} alt={alt} sizes={sizes} loading={priority ? "eager" : "lazy"} decoding="async" className={cn("size-full object-cover", className)} />
    );
  }
  const [bg1, bg2, ink, accent] = PALETTES[categorySlug] ?? DEFAULT_PALETTE;
  const gid = `g-${categorySlug}-${typeSlug ?? ""}`;
  return (
    <svg viewBox="0 0 200 200" aria-hidden className={cn("size-full", className)} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bg1} />
          <stop offset="1" stopColor={bg2} />
        </linearGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#${gid})`} />
      <circle cx="160" cy="40" r="46" fill="#fff" opacity="0.35" />
      <circle cx="30" cy="175" r="38" fill="#fff" opacity="0.25" />
      <g fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        {(typeSlug && <TypeIllustration slug={typeSlug} ink={ink} accent={accent} />) || <Illustration slug={categorySlug} ink={ink} accent={accent} />}
      </g>
    </svg>
  );
}

function Illustration({ slug, ink, accent }: { slug: string; ink: string; accent: string }) {
  switch (slug) {
    case "screen-protectors":
      return (
        <>
          <rect x="62" y="36" width="70" height="132" rx="14" fill="#fff" />
          <rect x="74" y="28" width="70" height="132" rx="14" fill={accent} fillOpacity="0.35" stroke={ink} strokeDasharray="0" />
          <path d="M88 52 L128 92 M96 46 L132 82" stroke="#fff" strokeWidth="6" opacity="0.9" />
          <circle cx="97" cy="40" r="2.5" fill={ink} stroke="none" />
        </>
      );
    case "cases-covers":
      return (
        <>
          <rect x="60" y="28" width="80" height="148" rx="20" fill={accent} fillOpacity="0.45" />
          <rect x="68" y="36" width="64" height="132" rx="14" fill="#fff" />
          <rect x="76" y="44" width="30" height="30" rx="8" fill={ink} fillOpacity="0.12" />
          <circle cx="86" cy="54" r="5" />
          <circle cx="98" cy="64" r="5" />
          <path d="M140 70 v20" strokeWidth="5" />
        </>
      );
    case "camera-protectors":
      return (
        <>
          <rect x="52" y="52" width="96" height="96" rx="26" fill="#fff" />
          <circle cx="80" cy="80" r="16" fill={accent} fillOpacity="0.5" />
          <circle cx="120" cy="80" r="16" fill={accent} fillOpacity="0.5" />
          <circle cx="80" cy="120" r="16" fill={accent} fillOpacity="0.5" />
          <circle cx="80" cy="80" r="6" fill={ink} stroke="none" />
          <circle cx="120" cy="80" r="6" fill={ink} stroke="none" />
          <circle cx="80" cy="120" r="6" fill={ink} stroke="none" />
          <circle cx="120" cy="120" r="5" fill={accent} />
        </>
      );
    case "chargers-cables":
      return (
        <>
          <rect x="58" y="56" width="58" height="66" rx="14" fill="#fff" />
          <path d="M74 56 V40 M100 56 V40" strokeWidth="6" />
          <path d="M80 82 L90 82 L84 96 L96 96" stroke={accent} strokeWidth="5" />
          <path d="M87 122 C 87 160, 150 150, 146 112 C 143 86, 158 74, 168 74" />
          <rect x="160" y="66" width="18" height="16" rx="4" fill={ink} stroke="none" />
        </>
      );
    case "power-banks":
      return (
        <>
          <rect x="44" y="64" width="112" height="72" rx="16" fill="#fff" />
          <path d="M98 78 L86 102 L102 102 L92 124" stroke={accent} strokeWidth="6" />
          <g fill={ink} stroke="none">
            <circle cx="126" cy="100" r="4" />
            <circle cx="138" cy="100" r="4" />
            <circle cx="126" cy="112" r="4" opacity="0.4" />
            <circle cx="138" cy="112" r="4" opacity="0.4" />
          </g>
          <path d="M60 136 v10 M140 136 v10" />
        </>
      );
    case "earbud-cases":
      return (
        <>
          <rect x="54" y="62" width="92" height="80" rx="38" fill="#fff" />
          <path d="M56 96 H144" />
          <circle cx="100" cy="118" r="4" fill={accent} stroke={ink} strokeWidth="2" />
          <path d="M142 70 C 160 60, 168 46, 160 34" stroke={accent} strokeWidth="5" />
          <circle cx="158" cy="30" r="7" />
        </>
      );
    case "cleaning-kits":
      return (
        <>
          <path d="M78 76 H110 V160 a10 10 0 0 1 -10 10 H88 a10 10 0 0 1 -10 -10 Z" fill="#fff" />
          <path d="M84 76 V58 H104 V76" />
          <path d="M104 62 H122 L118 70" />
          <path d="M128 52 l8 -4 M130 62 h10 M128 72 l8 4" stroke={accent} strokeWidth="5" />
          <path d="M116 132 C 130 118, 156 124, 160 140 C 150 156, 128 160, 116 150 Z" fill={accent} fillOpacity="0.5" />
        </>
      );
    case "laptop-sleeves":
      return (
        <>
          <rect x="52" y="44" width="96" height="66" rx="8" fill="#fff" />
          <rect x="40" y="88" width="120" height="76" rx="14" fill={accent} fillOpacity="0.7" />
          <path d="M40 104 H160" strokeDasharray="6 6" stroke={ink} strokeWidth="3" />
          <rect x="84" y="120" width="32" height="10" rx="5" fill="#fff" />
        </>
      );
    default:
      return (
        <>
          <rect x="64" y="34" width="72" height="132" rx="14" fill="#fff" />
          <path d="M84 146 H116" />
          <path d="M100 70 L100 110 M84 94 L100 110 L116 94" stroke={accent} />
        </>
      );
  }
}

/** Phone outline shared by the type drawings (front for glass, back for cases). */
const PHONE = { x: 66, y: 30, w: 68, h: 140, r: 14 };

function TypeIllustration({ slug, ink, accent }: { slug: string; ink: string; accent: string }) {
  const { x, y, w, h, r } = PHONE;
  const phone = <rect x={x} y={y} width={w} height={h} rx={r} fill="#fff" />;
  const glass = (opacity = 0.35) => <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} rx={r - 6} fill={accent} fillOpacity={opacity} stroke="none" />;
  const caseBack = (fill: string, opacity: number) => <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} rx={r + 6} fill={fill} fillOpacity={opacity} />;
  const cams = (
    <>
      <rect x={x + 6} y={y + 8} width="28" height="28" rx="8" fill={ink} fillOpacity="0.12" />
      <circle cx={x + 15} cy={y + 17} r="4.5" />
      <circle cx={x + 26} cy={y + 27} r="4.5" />
    </>
  );
  const corners = [
    [x - 6, y - 6],
    [x + w - 10, y - 6],
    [x - 6, y + h - 10],
    [x + w - 10, y + h - 10],
  ];
  const lenses = [
    [80, 80],
    [120, 80],
    [80, 120],
  ];
  switch (slug) {
    case "normal-clear":
      return (
        <>
          {phone}
          {glass()}
          <path d={`M${x + 16} ${y + 40} l30 -22 M${x + 16} ${y + 56} l40 -30`} stroke="#fff" strokeWidth="6" />
        </>
      );
    case "hd-plus":
      return (
        <>
          {phone}
          {glass(0.2)}
          <path
            d="M150 54 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z M48 120 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z"
            fill={accent}
            stroke={ink}
            strokeWidth="2.5"
          />
          <text x="100" y="108" textAnchor="middle" fontSize="22" fontWeight="800" fill={ink} stroke="none">
            HD+
          </text>
        </>
      );
    case "edge-to-edge":
      return (
        <>
          {phone}
          <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx={r - 2} fill={accent} fillOpacity="0.35" stroke={ink} strokeWidth="7" strokeOpacity="0.85" />
          <path d={`M${x + 16} ${y + 44} l34 -24`} stroke="#fff" strokeWidth="6" />
        </>
      );
    case "privacy":
      return (
        <>
          {phone}
          <path d={`M${x + 34} ${y + 6} H${x + w - 6} V${y + h - 6} H${x + 34} Z`} fill={ink} fillOpacity="0.75" stroke="none" />
          {glass(0.25)}
          <path d="M150 96 c10 -10 22 -10 32 0 c-10 10 -22 10 -32 0 z M150 110 l32 -28" stroke={ink} strokeWidth="3.5" />
        </>
      );
    case "matte":
      return (
        <>
          {phone}
          {glass(0.3)}
          <g fill={ink} fillOpacity="0.25" stroke="none">
            {Array.from({ length: 48 }, (_, i) => (
              <circle key={i} cx={x + 12 + (i % 6) * 9 + (Math.floor(i / 6) % 2) * 4} cy={y + 14 + Math.floor(i / 6) * 15} r="1.6" />
            ))}
          </g>
        </>
      );
    case "uv-curved":
      return (
        <>
          {phone}
          <path d={`M${x - 6} ${y + 24} q-8 ${h / 2 - 24} 0 ${h - 48} M${x + w + 6} ${y + 24} q8 ${h / 2 - 24} 0 ${h - 48}`} strokeWidth="5" stroke={accent} />
          {glass(0.3)}
          <path d="M100 18 v-10 M76 22 l-5 -8 M124 22 l5 -8" stroke="#7c3aed" strokeWidth="4" />
        </>
      );
    case "ceramic":
      return (
        <>
          {phone}
          <path d={`M${x + 8} ${y + 10} C ${x + 70} ${y + 10}, ${x + 96} ${y + 70}, ${x + 104} ${y + 136}`} stroke={accent} strokeWidth="14" strokeOpacity="0.7" />
          <path d={`M${x + 8} ${y + 10} C ${x + 70} ${y + 10}, ${x + 96} ${y + 70}, ${x + 104} ${y + 136}`} />
        </>
      );
    case "lens-glass":
      return (
        <>
          <rect x="52" y="52" width="96" height="96" rx="26" fill="#fff" />
          <rect x="58" y="58" width="84" height="84" rx="22" fill={accent} fillOpacity="0.4" />
          {lenses.map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="13" />
          ))}
          <path d="M66 70 l24 -8" stroke="#fff" strokeWidth="5" />
        </>
      );
    case "metal-ring":
      return (
        <>
          <rect x="52" y="52" width="96" height="96" rx="26" fill="#fff" />
          {lenses.map(([cx, cy]) => (
            <g key={`${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r="17" strokeWidth="7" />
              <circle cx={cx} cy={cy} r="9" fill={accent} fillOpacity="0.6" stroke="none" />
            </g>
          ))}
        </>
      );
    case "normal-silicone":
      return (
        <>
          {caseBack(ink, 0.85)}
          <g stroke="#fff">{cams}</g>
          <path d={`M${x + w + 6} ${y + 50} v24`} stroke="#fff" strokeWidth="4" />
        </>
      );
    case "anti-yellow":
      return (
        <>
          {caseBack(accent, 0.25)}
          {phone}
          {cams}
          <circle cx="160" cy="150" r="16" fill="#fff" strokeWidth="3" />
          <circle cx="160" cy="150" r="6" fill="#facc15" stroke="none" />
          <path d="M148 162 l24 -24" strokeWidth="3.5" />
        </>
      );
    case "liquid-silicone":
      return (
        <>
          {caseBack(accent, 0.85)}
          {cams}
          <path d={`M${x + 10} ${y + 120} q${w / 2 - 10} 12 ${w - 20} 0`} stroke="#fff" strokeOpacity="0.6" />
        </>
      );
    case "magsafe":
      return (
        <>
          {caseBack(accent, 0.3)}
          {phone}
          {cams}
          <circle cx="100" cy="112" r="24" strokeWidth="5" />
          <path d="M100 136 v14" strokeWidth="5" />
        </>
      );
    case "rugged":
      return (
        <>
          {caseBack(ink, 0.9)}
          {corners.map(([cx, cy]) => (
            <rect key={`${cx}-${cy}`} x={cx} y={cy} width="16" height="16" rx="6" fill={accent} stroke="none" />
          ))}
          <g stroke="#fff">{cams}</g>
          <path d={`M${x + 14} ${y + 70} h${w - 28} M${x + 14} ${y + 82} h${w - 28}`} stroke="#fff" strokeOpacity="0.5" />
        </>
      );
    case "slim-matte":
      return (
        <>
          <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={r + 3} fill={accent} fillOpacity="0.55" />
          {cams}
          <text x="100" y="186" textAnchor="middle" fontSize="12" fontWeight="700" fill={ink} stroke="none">
            0.8 mm
          </text>
        </>
      );
    case "flip-wallet":
      return (
        <>
          <rect x={x - 30} y={y} width={w} height={h} rx={r} fill={ink} fillOpacity="0.85" />
          <rect x={x + 30} y={y} width={w} height={h} rx={r} fill="#fff" />
          <rect x={x - 22} y={y + 22} width="44" height="16" rx="4" fill="#fff" fillOpacity="0.85" stroke="none" />
          <rect x={x - 22} y={y + 44} width="44" height="16" rx="4" fill="#fff" fillOpacity="0.6" stroke="none" />
        </>
      );
    default:
      return null;
  }
}
