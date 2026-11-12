import { NextResponse } from "next/server";
import { api } from "@/server/http";
import { authorizeMedia, removeMedia } from "@/server/modules/media/media.service";
import { storage } from "@/server/storage/storage";

/**
 * GET /api/v1/media/{id} — public assets are immutable and cached for a year;
 * private artwork is authorised per request (signed URL redirect on S3/R2, streamed locally).
 */
export const GET = api<RouteContext<"/api/v1/media/[id]">>(async (_req, ctx, actor) => {
  const { id } = await ctx.params;
  const media = await authorizeMedia(actor, id);
  const store = storage();
  // Public images are streamed under this stable URL so the CDN and browsers keep them (a day, then revalidate);
  // a signed redirect would change on every request and could never be cached. Large files (3D models) stay on
  // redirects: serverless responses are capped at 4.5 MB.
  if (media.isPublic && media.sizeBytes <= 4_000_000) {
    const body = await store.read(media.storageKey);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": media.mime,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "CDN-Cache-Control": "public, max-age=2592000, stale-while-revalidate=604800",
        "Content-Disposition": "inline",
      },
    });
  }
  const signed = await store.signedUrl(media.storageKey, media.isPublic ? 3600 : 60);
  if (signed) return NextResponse.redirect(signed, { headers: { "Cache-Control": media.isPublic ? "public, max-age=3000" : "private, no-store" } });
  const body = await store.read(media.storageKey);
  const cache = media.isPublic ? "public, max-age=31536000, immutable" : "private, max-age=300";
  return new Response(new Uint8Array(body), { headers: { "Content-Type": media.mime, "Cache-Control": cache, "Content-Disposition": "inline" } });
});

/** DELETE /api/v1/media/{id} — remove your own unattached artwork, or an unused public asset (staff). */
export const DELETE = api<RouteContext<"/api/v1/media/[id]">>(async (_req, ctx, actor) => {
  const { id } = await ctx.params;
  await removeMedia(actor, id);
  return { removed: true };
});
