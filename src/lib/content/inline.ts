/**
 * Minimal, safe inline markup for content blocks: **bold**, *italic* and [label](href).
 * Output is a token tree rendered as React text nodes, so raw HTML is never interpreted.
 * Links are allow-listed: https/http, site-relative paths, #anchors, mailto: and tel:.
 */
export type InlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "link"; href: string; external: boolean; children: InlineNode[] };

const HTML_TAG = /<\/?[a-z!][^>]*>/i;

/** True when the string contains something that looks like an HTML tag (blocked in content). */
export const containsHtml = (s: string) => HTML_TAG.test(s);

/** Returns a safe href or null. Rejects javascript:, data:, vbscript:, protocol-relative URLs and control characters. */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href || /[\u0000-\u001f\u007f\s]/.test(href)) return null;
  if (href.startsWith("#")) return /^#[\w-]+$/.test(href) ? href : null;
  if (href.startsWith("/")) return href.startsWith("//") || href.startsWith("/\\") ? null : href;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1]?.toLowerCase();
  if (scheme === "https" || scheme === "http") {
    try {
      const u = new URL(href);
      return u.hostname ? u.toString() : null;
    } catch {
      return null;
    }
  }
  if (scheme === "mailto" || scheme === "tel") return href;
  return null;
}

const TOKEN = /\*\*([\s\S]+?)\*\*|\*([^*\n]+?)\*|\[([^\]\n]+)\]\(([^)\s]+)\)/;

export function parseInline(src: string, depth = 0): InlineNode[] {
  const out: InlineNode[] = [];
  let rest = src;
  while (rest) {
    const m = depth > 3 ? null : TOKEN.exec(rest);
    if (!m) {
      out.push({ type: "text", value: rest });
      break;
    }
    if (m.index > 0) out.push({ type: "text", value: rest.slice(0, m.index) });
    if (m[1] !== undefined) out.push({ type: "strong", children: parseInline(m[1], depth + 1) });
    else if (m[2] !== undefined) out.push({ type: "em", children: parseInline(m[2], depth + 1) });
    else {
      const label = parseInline(m[3]!, depth + 1);
      const href = safeHref(m[4]!);
      if (href) out.push({ type: "link", href, external: /^https?:/i.test(href), children: label });
      else out.push(...label); // unsafe link → keep the label as text only
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return mergeText(out);
}

function mergeText(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const n of nodes) {
    const prev = out.at(-1);
    if (n.type === "text" && prev?.type === "text") prev.value += n.value;
    else out.push(n);
  }
  return out;
}

/** Inline markup stripped to plain text (for meta descriptions, reading time, search). */
export function plainText(src: string): string {
  const walk = (nodes: InlineNode[]): string => nodes.map((n) => (n.type === "text" ? n.value : walk(n.children))).join("");
  return walk(parseInline(src));
}
