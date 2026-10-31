export type ParsedVideo = { provider: "youtube" | "vimeo"; id: string; embedUrl: string; thumbnailUrl: string | null; watchUrl: string };

/** Recognise YouTube / Vimeo URLs and produce privacy-friendly embed URLs (youtube-nocookie, Vimeo dnt). */
export function parseVideoUrl(raw: string | null | undefined): ParsedVideo | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let yt: string | null = null;
  if (host === "youtu.be") yt = u.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") yt = u.searchParams.get("v");
    else {
      const m = /^\/(?:embed|shorts|live)\/([\w-]+)/.exec(u.pathname);
      yt = m?.[1] ?? null;
    }
  }
  if (yt && /^[\w-]{6,20}$/.test(yt)) {
    return {
      provider: "youtube",
      id: yt,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&autoplay=1`,
      thumbnailUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      watchUrl: `https://www.youtube.com/watch?v=${yt}`,
    };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = /\/(?:video\/)?(\d{5,12})/.exec(u.pathname);
    if (m) return { provider: "vimeo", id: m[1]!, embedUrl: `https://player.vimeo.com/video/${m[1]}?dnt=1&autoplay=1`, thumbnailUrl: null, watchUrl: `https://vimeo.com/${m[1]}` };
  }
  return null;
}
