import { NextResponse } from "next/server";
import { api } from "@/server/http";
import { authorizeAttachment } from "@/server/modules/repairs/attachment.service";
import { storage } from "@/server/storage/storage";

/**
 * GET /api/v1/attachments/{id} — authorised file access (§13.2).
 * S3/R2: redirect to a 60-second signed URL. Local dev storage: stream the bytes.
 */
export const GET = api<RouteContext<"/api/v1/attachments/[id]">>(async (_req, ctx, actor) => {
  const { id } = await ctx.params;
  const att = await authorizeAttachment(actor, id);
  const store = storage();
  const signed = await store.signedUrl(att.storageKey, 60);
  if (signed) return NextResponse.redirect(signed, { headers: { "Cache-Control": "private, no-store" } });
  const body = await store.read(att.storageKey);
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": att.mime, "Cache-Control": "private, max-age=300", "Content-Disposition": "inline" },
  });
});
