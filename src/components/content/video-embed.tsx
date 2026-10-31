"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { parseVideoUrl } from "@/lib/content/video";

/**
 * Click-to-load video: nothing is fetched from YouTube/Vimeo until the reader presses play
 * (privacy-friendly; YouTube via youtube-nocookie.com, Vimeo with dnt=1).
 */
export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const video = parseVideoUrl(url);
  if (!video) return null;
  const provider = video.provider === "youtube" ? "YouTube" : "Vimeo";

  return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-border">
      <div className="relative aspect-video">
        {playing ? (
          <iframe
            src={video.embedUrl}
            title={title}
            className="absolute inset-0 size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 flex items-center justify-center" aria-label={t("videos.play", { title })}>
            {video.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- third-party thumbnail, loaded lazily
              <img src={video.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-80 transition group-hover:opacity-95" />
            ) : (
              <span className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" />
            )}
            <span className="relative flex size-16 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg transition group-hover:scale-105">
              <svg viewBox="0 0 24 24" className="ml-1 size-7" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      {!playing && (
        <p className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 px-4 py-2 text-xs text-slate-300">
          <span>{t("videos.consent", { provider })}</span>
          <a href={video.watchUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">
            {t("videos.openOn", { provider })}
          </a>
        </p>
      )}
    </div>
  );
}
