"use client";
import { useRef, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { mediaUrl } from "@/lib/media";

export async function uploadPublicImage(file: File, purpose: "CONTENT_IMAGE" | "DEVICE_IMAGE", alt?: string) {
  const form = new FormData();
  form.set("file", file);
  form.set("purpose", purpose);
  if (alt) form.set("altEn", alt);
  return apiFetch<{ id: string; width: number; height: number }>("/api/v1/media", { method: "POST", body: form });
}

/** Image picker with preview: uploads to /api/v1/media (validated + re-encoded server-side) and returns the media id. */
export function ImageUpload({
  value,
  onChange,
  purpose = "CONTENT_IMAGE",
  label = "Image",
}: {
  value: string | null | undefined;
  onChange: (mediaId: string | null) => void;
  purpose?: "CONTENT_IMAGE" | "DEVICE_IMAGE";
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await uploadPublicImage(file, purpose);
      onChange(res.id);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded media asset */}
          <img src={mediaUrl(value)} alt="" className="max-h-56 w-full object-contain" />
          <div className="absolute top-2 right-2 flex gap-1">
            <button type="button" onClick={() => input.current?.click()} className="rounded-md bg-surface/95 px-2 py-1 text-xs font-medium shadow">
              Replace
            </button>
            <button type="button" onClick={() => onChange(null)} className="rounded-md bg-surface/95 px-2 py-1 text-xs font-medium text-danger shadow">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-sm text-muted hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {busy ? "Uploading…" : `Upload ${label.toLowerCase()} (JPEG, PNG or WebP, max 10 MB)`}
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Upload ${label}`} onChange={(e) => onFile(e.target.files?.[0])} />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
