"use client";
import dynamic from "next/dynamic";
import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";
import type { DeviceViewer as Viewer } from "./device-viewer";

// The 3D engine is a separate chunk, fetched only when the visitor asks for the 3D view.
const DeviceViewer = dynamic(() => import("./device-viewer").then((m) => m.DeviceViewer), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-2xl bg-white/5" />,
});

/** Product photo by default, with a Photo / 3D switch; without a photo, a button that opens the 3D view. */
export function PhotoOr3D({
  imageId,
  alt,
  labels,
  fallback,
  className,
  ...viewer
}: ComponentProps<typeof Viewer> & {
  imageId: string | null;
  alt: string;
  labels: { photo: string; view3d: string; open3d: string };
  /** Shown above the "View in 3D" button when there is no photo. */
  fallback?: ReactNode;
}) {
  const [mode, setMode] = useState<"photo" | "3d">("photo");
  const tab = (m: "photo" | "3d", text: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => setMode(m)}
      className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", mode === m ? "bg-white text-black" : "text-white/70 hover:text-white")}
    >
      {text}
    </button>
  );
  return (
    <div className={cn("relative", className)}>
      {mode === "3d" ? (
        <DeviceViewer {...viewer} className="size-full" />
      ) : imageId ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by the media route (redirects to signed storage URLs)
        <img src={mediaUrl(imageId)} alt={alt} className="size-full object-contain p-4 drop-shadow-2xl" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-4">
          {fallback}
          <button type="button" onClick={() => setMode("3d")} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90">
            {labels.open3d}
          </button>
        </div>
      )}
      {(imageId || mode === "3d") && (
        <div className="absolute top-2 left-2 flex gap-1 rounded-full bg-black/40 p-1 backdrop-blur" role="group">
          {imageId && tab("photo", labels.photo)}
          {tab("3d", labels.view3d)}
        </div>
      )}
    </div>
  );
}
