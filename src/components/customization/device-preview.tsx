import type { ReactNode } from "react";
import { FONT_FAMILIES, type DesignStyle, type DeviceKind, type TextFont, type TextPosition } from "@/lib/customization/style";
import { frameFor, frontLayout, sizedFrame, type FrameGeometry, type ModuleShape } from "@/lib/device-frames";

/**
 * Generative, dependency-free SVG preview of a device skin. Pure (no hooks), so it renders the same
 * on the server (account, admin) and in the client studio from a stored configuration snapshot.
 * It is an illustration of the selected options, not a print proof.
 */
export type PreviewProps = {
  kind: DeviceKind;
  /** The model's frame family (camera layout, see src/lib/device-frames.ts); unknown → the kind's generic shape. */
  frame?: string | null;
  /** Real height / width (from the model's mm dimensions); default: the frame family's proportions. */
  aspect?: number | null;
  /** "front" shows the display side (skin visible only on the edges for sides/full coverage). */
  view?: "back" | "front";
  style: DesignStyle;
  /** Finish option slug: matte | gloss | metallic | carbon | leather (unknown → plain). */
  finish?: string | null;
  /** Coverage option slug: back | camera | sides | full. */
  coverage?: string | null;
  text?: { value: string; font: TextFont; position: TextPosition; color: string } | null;
  artwork?: { href: string; scale: number; x: number; y: number } | null;
  /** Stable seed for random-looking patterns (defaults to the style itself). */
  seed?: string;
  label: string;
  className?: string;
};

const FRAME = "#2a2e39";

// ───────────── deterministic randomness ─────────────

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const at = (p: string[], i: number) => p[((i % p.length) + p.length) % p.length];
const round = (n: number) => Math.round(n * 10) / 10;

// ───────────── patterns ─────────────

function renderPattern(style: DesignStyle, w: number, h: number, uid: string, seed: string): { defs: ReactNode; body: ReactNode } {
  const p = style.palette;
  const d = style.density;
  const rand = rng(hash(seed));
  const bg = <rect width={w} height={h} fill={p[0]} />;
  const cx = w / 2;
  const cy = h / 2;
  const diag = Math.hypot(w, h);

  switch (style.pattern) {
    case "solid":
      return { defs: null, body: bg };

    case "gradient": {
      const id = `${uid}-grad`;
      return {
        defs: (
          <linearGradient id={id} gradientTransform={`rotate(${style.angle} .5 .5)`}>
            {p.map((c, i) => (
              <stop key={i} offset={p.length === 1 ? 0 : i / (p.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
        ),
        body: <rect width={w} height={h} fill={`url(#${id})`} />,
      };
    }

    case "waves": {
      const n = 4 + d;
      const amp = h / (n * 2.2);
      const paths = Array.from({ length: n + 2 }, (_, i) => {
        const y = (i - 0.5) * (h / n);
        const freq = 1.5 + (d % 3) * 0.5;
        let path = `M ${-20} ${y}`;
        for (let x = -20; x <= w + 20; x += 10) path += ` L ${x} ${round(y + Math.sin((x / w) * Math.PI * 2 * freq + i * 0.9) * amp)}`;
        return <path key={i} d={path} fill="none" stroke={at(p, i + 1)} strokeWidth={round(amp * 0.9)} strokeLinecap="round" />;
      });
      return { defs: null, body: <>{bg}{paths}</> };
    }

    case "grid": {
      const s = w / (d + 3);
      const cells: ReactNode[] = [];
      for (let y = 0; y < h; y += s)
        for (let x = 0; x < w; x += s) if (rand() < 0.18) cells.push(<rect key={`${x}-${y}`} x={x + 3} y={y + 3} width={s - 6} height={s - 6} rx={4} fill={at(p, 2 + Math.floor(rand() * 3))} />);
      const lines: ReactNode[] = [];
      for (let x = 0; x <= w; x += s) lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={h} stroke={p[1]} strokeWidth={2} />);
      for (let y = 0; y <= h; y += s) lines.push(<line key={`h${y}`} x1={0} y1={y} x2={w} y2={y} stroke={p[1]} strokeWidth={2} />);
      return { defs: null, body: <>{bg}{cells}{lines}</> };
    }

    case "dots": {
      const s = w / (d + 5);
      const fx = w * 0.7;
      const fy = h * 0.3;
      const dots: ReactNode[] = [];
      let i = 0;
      for (let y = s / 2; y < h; y += s)
        for (let x = s / 2; x < w; x += s) {
          const t = 1 - Math.min(1, Math.hypot(x - fx, y - fy) / diag) * 1.3;
          dots.push(<circle key={i} cx={round(x)} cy={round(y)} r={round(Math.max(1.2, (s / 2.2) * Math.max(0.15, t)))} fill={at(p, 1 + (i++ % Math.max(1, p.length - 1)))} />);
        }
      return { defs: null, body: <>{bg}{dots}</> };
    }

    case "stripes": {
      const s = diag / (d * 2 + 6);
      const stripes = Array.from({ length: Math.ceil((diag * 2) / s) }, (_, i) => (
        <rect key={i} x={-diag / 2 + i * s} y={-diag / 2} width={s / 2} height={diag * 2} fill={at(p, 1 + (i % Math.max(1, p.length - 1)))} />
      ));
      return { defs: null, body: <>{bg}<g transform={`rotate(${style.angle} ${cx} ${cy})`}>{stripes}</g></> };
    }

    case "topo": {
      const rings: ReactNode[] = [];
      const centers = [
        [w * (0.25 + rand() * 0.2), h * (0.25 + rand() * 0.15)],
        [w * (0.6 + rand() * 0.2), h * (0.65 + rand() * 0.15)],
      ];
      centers.forEach(([ox, oy], c) => {
        for (let k = 1; k <= 6 + d; k++) {
          const base = k * (diag / (14 + d));
          const ph = rand() * 6;
          let path = "";
          for (let a = 0; a <= 64; a++) {
            const th = (a / 64) * Math.PI * 2;
            const rr = base * (1 + 0.12 * Math.sin(th * 3 + ph) + 0.06 * Math.sin(th * 5 + ph * 2));
            path += `${a === 0 ? "M" : "L"} ${round(ox + Math.cos(th) * rr)} ${round(oy + Math.sin(th) * rr)} `;
          }
          rings.push(<path key={`${c}-${k}`} d={path + "Z"} fill="none" stroke={at(p, 1 + ((k + c) % Math.max(1, p.length - 1)))} strokeWidth={2.2} opacity={0.9} />);
        }
      });
      return { defs: null, body: <>{bg}{rings}</> };
    }

    case "blobs": {
      const id = `${uid}-blur`;
      const blobs = Array.from({ length: 4 + Math.round(d / 2) }, (_, i) => (
        <ellipse key={i} cx={round(rand() * w)} cy={round(rand() * h)} rx={round(w * (0.25 + rand() * 0.3))} ry={round(h * (0.15 + rand() * 0.2))} fill={at(p, 1 + i)} opacity={0.85} />
      ));
      return {
        defs: (
          <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={w / 9} />
          </filter>
        ),
        body: <>{bg}<g filter={`url(#${id})`}>{blobs}</g></>,
      };
    }

    case "chevron": {
      const s = h / (d + 4);
      const zig = s * 0.8;
      const rows = Array.from({ length: Math.ceil(h / s) + 2 }, (_, i) => {
        let path = `M -${zig} ${i * s}`;
        for (let x = -zig, up = true; x <= w + zig; x += zig, up = !up) path += ` L ${round(x + zig)} ${round(i * s + (up ? -zig / 2 : zig / 2))}`;
        return <path key={i} d={path} fill="none" stroke={at(p, 1 + (i % Math.max(1, p.length - 1)))} strokeWidth={round(s * 0.32)} strokeLinejoin="miter" />;
      });
      return { defs: null, body: <>{bg}{rows}</> };
    }

    case "terrazzo": {
      const chips = Array.from({ length: 40 + d * 14 }, (_, i) => {
        const x = rand() * w;
        const y = rand() * h;
        const size = 4 + rand() * (w / 22);
        const corners = 3 + Math.floor(rand() * 3);
        const pts = Array.from({ length: corners }, (_, k) => {
          const th = (k / corners) * Math.PI * 2 + rand();
          const rr = size * (0.6 + rand() * 0.6);
          return `${round(x + Math.cos(th) * rr)},${round(y + Math.sin(th) * rr)}`;
        }).join(" ");
        return <polygon key={i} points={pts} fill={at(p, 1 + Math.floor(rand() * (p.length - 1)))} />;
      });
      return { defs: null, body: <>{bg}{chips}</> };
    }

    case "sunburst": {
      const n = 10 + d * 2;
      const ox = cx;
      const oy = h * 0.82;
      const rays = Array.from({ length: n }, (_, i) => {
        const a1 = Math.PI + (i / n) * Math.PI;
        const a2 = Math.PI + ((i + 0.5) / n) * Math.PI;
        return (
          <polygon
            key={i}
            points={`${ox},${oy} ${round(ox + Math.cos(a1) * diag)},${round(oy + Math.sin(a1) * diag)} ${round(ox + Math.cos(a2) * diag)},${round(oy + Math.sin(a2) * diag)}`}
            fill={at(p, 1 + (i % 2))}
          />
        );
      });
      return { defs: null, body: <>{bg}{rays}<circle cx={ox} cy={oy} r={w * 0.24} fill={at(p, 3)} /><rect x={0} y={oy} width={w} height={h - oy} fill={at(p, 4)} /></> };
    }

    case "checker": {
      const s = diag / (d * 2 + 4);
      const sq: ReactNode[] = [];
      for (let y = -diag / 2, r = 0; y < diag * 1.5; y += s, r++)
        for (let x = -diag / 2, c = 0; x < diag * 1.5; x += s, c++) if ((r + c) % 2 === 0) sq.push(<rect key={`${r}-${c}`} x={round(x)} y={round(y)} width={round(s)} height={round(s)} fill={at(p, 1 + ((r + c) / 2) % Math.max(1, p.length - 1))} />);
      return { defs: null, body: <>{bg}<g transform={`rotate(${style.angle % 90} ${cx} ${cy})`}>{sq}</g></> };
    }

    case "letters": {
      const size = w / (2.5 + d / 3);
      const word = "TECHNENTIUM ";
      const rows = Array.from({ length: Math.ceil(h / (size * 0.95)) + 1 }, (_, i) => (
        <text key={i} x={-((i * size) % (size * 3))} y={round((i + 0.85) * size * 0.95)} fontSize={round(size)} fontWeight={900} style={{ fontFamily: FONT_FAMILIES.display }} fill={at(p, 1 + (i % Math.max(1, p.length - 1)))} opacity={0.9}>
          {word.repeat(4)}
        </text>
      ));
      return { defs: null, body: <>{bg}{rows}</> };
    }
  }
}

// ───────────── finishes ─────────────

function renderFinish(finish: string | null | undefined, w: number, h: number, uid: string): { defs: ReactNode; body: ReactNode } {
  switch (finish) {
    case "matte":
      return {
        defs: (
          <filter id={`${uid}-noise`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0.18" />
            </feComponentTransfer>
          </filter>
        ),
        body: (
          <>
            <rect width={w} height={h} filter={`url(#${uid}-noise)`} />
            <rect width={w} height={h} fill="#000" opacity={0.06} />
          </>
        ),
      };
    case "gloss":
      return {
        defs: (
          <linearGradient id={`${uid}-gloss`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0.55} />
            <stop offset="0.38" stopColor="#fff" stopOpacity={0.08} />
            <stop offset="0.39" stopColor="#fff" stopOpacity={0} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        ),
        body: <rect width={w} height={h} fill={`url(#${uid}-gloss)`} />,
      };
    case "metallic":
      return {
        defs: (
          <>
            <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="0.3">
              {[0, 0.18, 0.32, 0.5, 0.68, 0.82, 1].map((o, i) => (
                <stop key={o} offset={o} stopColor={i % 2 ? "#000" : "#fff"} stopOpacity={i % 2 ? 0.22 : 0.4} />
              ))}
            </linearGradient>
            <filter id={`${uid}-brush`}>
              <feTurbulence type="fractalNoise" baseFrequency="0.004 0.9" numOctaves={1} />
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncA type="table" tableValues="0 0.22" />
              </feComponentTransfer>
            </filter>
          </>
        ),
        body: (
          <>
            <rect width={w} height={h} fill={`url(#${uid}-metal)`} style={{ mixBlendMode: "overlay" }} />
            <rect width={w} height={h} filter={`url(#${uid}-brush)`} />
          </>
        ),
      };
    case "carbon":
      return {
        defs: (
          <pattern id={`${uid}-carbon`} width={10} height={10} patternUnits="userSpaceOnUse">
            <rect width={5} height={5} fill="#000" opacity={0.45} />
            <rect x={5} y={5} width={5} height={5} fill="#000" opacity={0.45} />
            <rect x={5} width={5} height={5} fill="#fff" opacity={0.12} />
            <rect y={5} width={5} height={5} fill="#fff" opacity={0.12} />
          </pattern>
        ),
        body: <rect width={w} height={h} fill={`url(#${uid}-carbon)`} style={{ mixBlendMode: "multiply" }} />,
      };
    case "leather":
      return {
        defs: (
          <>
            <filter id={`${uid}-grain`}>
              <feTurbulence type="turbulence" baseFrequency="0.22" numOctaves={3} stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncA type="table" tableValues="0 0.3" />
              </feComponentTransfer>
            </filter>
            <radialGradient id={`${uid}-vignette`} r="0.75">
              <stop offset="0.55" stopColor="#000" stopOpacity={0} />
              <stop offset="1" stopColor="#000" stopOpacity={0.4} />
            </radialGradient>
          </>
        ),
        body: (
          <>
            <rect width={w} height={h} filter={`url(#${uid}-grain)`} />
            <rect width={w} height={h} fill={`url(#${uid}-vignette)`} />
          </>
        ),
      };
    default:
      return { defs: null, body: null };
  }
}

// ───────────── component ─────────────

function Shape({ s, ...props }: { s: ModuleShape } & React.SVGAttributes<SVGElement>) {
  return s.shape === "rect" ? <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} {...props} /> : <circle cx={s.cx} cy={s.cy} r={s.r} {...props} />;
}

export function DevicePreview({ kind, frame, aspect, view = "back", style, finish, coverage, text, artwork, seed, label, className }: PreviewProps) {
  const g = sizedFrame(frameFor(frame, kind), aspect);
  const { w, h } = g;
  const key = JSON.stringify([kind, frame, g.h, view, style, finish, coverage, text, artwork?.href, artwork?.scale, artwork?.x, artwork?.y, seed]);
  const uid = `dp${hash(key).toString(36)}`;
  const seedStr = seed ?? JSON.stringify(style);

  const cov = coverage ?? "back";
  const inset = cov === "back" || cov === "camera" ? (g.kind === "laptop" ? 9 : 11) : 0;
  const coverModules = cov === "camera" || cov === "full";
  const edgeWrap = cov === "sides" || cov === "full";

  const pattern = renderPattern(style, w, h, uid, seedStr);
  const fin = renderFinish(finish, w, h, uid);

  const fontSize = text ? Math.min(w * 0.16, (w * 1.55) / Math.max(4, text.value.length)) : 0;
  const textY = text ? { top: h * g.textTop, center: h * 0.55, bottom: h * 0.86 }[text.position] : 0;
  const art = artwork ? { size: w * artwork.scale, x: w / 2 + (artwork.x * w) / 2, y: h / 2 + (artwork.y * h) / 2 } : null;

  const skinContent = (
    <>
      {pattern.body}
      {art && <image href={artwork!.href} x={round(art.x - art.size / 2)} y={round(art.y - art.size / 2)} width={round(art.size)} height={round(art.size)} preserveAspectRatio="xMidYMid meet" />}
      {text && (
        <text x={w / 2} y={round(textY)} textAnchor="middle" dominantBaseline="middle" fontSize={round(fontSize)} style={{ fontFamily: FONT_FAMILIES[text.font] }} fontWeight={text.font === "display" ? 400 : 700} letterSpacing={text.font === "mono" ? 2 : 1} fill={text.color}>
          {text.value}
        </text>
      )}
      {fin.body}
    </>
  );

  return (
    <svg viewBox={`-24 -24 ${w + 48} ${h + 48}`} role="img" aria-label={label} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000" floodOpacity="0.35" />
        </filter>
        <clipPath id={`${uid}-skin`}>
          <rect x={inset} y={inset} width={w - inset * 2} height={h - inset * 2} rx={Math.max(4, g.r - inset)} />
        </clipPath>
        {g.modules.length > 0 && (
          <clipPath id={`${uid}-modules`}>
            {g.modules.map((m, i) => (
              <Shape key={i} s={m} />
            ))}
          </clipPath>
        )}
        {pattern.defs}
        {fin.defs}
        <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.35} />
          <stop offset="1" stopColor="#fff" stopOpacity={0.05} />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1c2230" />
          <stop offset="0.55" stopColor="#0b0e15" />
          <stop offset="1" stopColor="#141a26" />
        </linearGradient>
      </defs>

      <g filter={`url(#${uid}-shadow)`}>
        <rect width={w} height={h} rx={g.r} fill={FRAME} />
      </g>

      {view === "front" ? (
        <FrontFace uid={uid} g={g} edgeWrap={edgeWrap} skin={skinContent} />
      ) : (
        <>
          <g clipPath={`url(#${uid}-skin)`}>{skinContent}</g>
          {/* Flip phones: the outer display is glass, never skinned. */}
          {g.cover && <rect x={g.cover.x} y={g.cover.y} width={g.cover.w} height={g.cover.h} rx={g.cover.r} fill="#05070b" stroke="#fff" strokeOpacity={0.12} strokeWidth={2} />}
          {g.hinge && <line x1={0} x2={w} y1={g.hinge} y2={g.hinge} stroke="#000" strokeOpacity={0.35} strokeWidth={3} />}
          {g.modules.length > 0 &&
            (coverModules ? (
              <g clipPath={`url(#${uid}-modules)`}>
                {skinContent}
                <rect width={w} height={h} fill="#000" opacity={0.12} />
              </g>
            ) : (
              g.modules.map((m, i) => <Shape key={i} s={m} fill={FRAME} />)
            ))}
          {g.modules.map((m, i) => (
            <Shape key={i} s={m} fill="none" stroke="#fff" strokeOpacity={0.18} strokeWidth={2} />
          ))}
          {g.glyph && (
            <path
              d={`M ${w / 2} ${h * 0.32} v ${h * 0.2} M ${w * 0.3} ${h * 0.62} a ${w * 0.2} ${w * 0.2} 0 0 0 ${w * 0.4} 0`}
              fill="none"
              stroke="#fff"
              strokeOpacity={0.55}
              strokeWidth={5}
              strokeLinecap="round"
            />
          )}
          {/* Skin cut-outs: a thin gap around each lens and flash (and around the modules when they're not covered). */}
          {[...g.lenses, ...g.flash].map(([x, y, r], i) => (
            <circle key={`cut${i}`} cx={x} cy={y} r={r + 4} fill="none" stroke="#000" strokeOpacity={0.45} strokeWidth={2} />
          ))}
          {!coverModules &&
            g.modules.map((m, i) => (
              <Shape key={`mcut${i}`} s={m.shape === "rect" ? { ...m, x: m.x - 3, y: m.y - 3, w: m.w + 6, h: m.h + 6, r: m.r + 3 } : { ...m, r: m.r + 3 }} fill="none" stroke="#000" strokeOpacity={0.4} strokeWidth={1.5} />
            ))}
          {g.lenses.map(([x, y, r], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill="#0b0d12" stroke="#3b4150" strokeWidth={4} />
              <circle cx={x} cy={y} r={r * 0.55} fill="#1b2233" />
              <circle cx={x - r * 0.25} cy={y - r * 0.25} r={r * 0.18} fill="#fff" opacity={0.4} />
            </g>
          ))}
          {g.flash.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#f5efd8" stroke="#3b4150" strokeWidth={2} />
          ))}
          {g.logo && cov !== "full" && <circle cx={g.logo[0]} cy={g.logo[1]} r={g.logo[2]} fill={FRAME} stroke="#fff" strokeOpacity={0.2} />}
        </>
      )}

      {/* Edge wrap: sides and full coverage reach the rounded edges. */}
      <rect x={1.5} y={1.5} width={w - 3} height={h - 3} rx={g.r - 1} fill="none" stroke={edgeWrap ? `url(#${uid}-edge)` : "#fff"} strokeOpacity={edgeWrap ? 1 : 0.08} strokeWidth={edgeWrap ? 5 : 2} />
    </svg>
  );
}

/** Display side: dark glass with the model's cut-out; a sides/full skin shows as a band around the edge. */
function FrontFace({ uid, g, edgeWrap, skin }: { uid: string; g: FrameGeometry; edgeWrap: boolean; skin: ReactNode }) {
  const { screen, cutouts } = frontLayout(g);
  return (
    <>
      {edgeWrap && <g clipPath={`url(#${uid}-skin)`}>{skin}</g>}
      <rect x={screen.x - 3} y={screen.y - 3} width={screen.w + 6} height={screen.h + 6} rx={screen.r + 3} fill="#05070b" />
      <rect x={screen.x} y={screen.y} width={screen.w} height={screen.h} rx={screen.r} fill={`url(#${uid}-glass)`} />
      <path d={`M ${screen.x + screen.w * 0.08} ${screen.y + screen.h * 0.12} l ${screen.w * 0.5} ${-screen.h * 0.06} l 0 ${screen.h * 0.12} z`} fill="#fff" opacity={0.05} />
      {cutouts.map((c, i) => (
        <Shape key={i} s={c} fill="#000" />
      ))}
    </>
  );
}
