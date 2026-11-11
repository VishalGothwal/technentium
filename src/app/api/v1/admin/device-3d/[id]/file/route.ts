import { api } from "@/server/http";
import { AppError } from "@/server/errors";
import { MAX_GLB_BYTES } from "@/lib/device-3d";
import { putGlbDirect } from "@/server/modules/catalog/device-3d-admin.service";

/**
 * PUT /api/v1/admin/device-3d/{id}/file?key=… — raw .glb body, for storage without signed uploads (local disk).
 * With S3/R2 the browser PUTs straight to the bucket and finishes with a server action instead.
 */
export const PUT = api<RouteContext<"/api/v1/admin/device-3d/[id]/file">>(async (req, ctx, actor) => {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
  const { id } = await ctx.params;
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (Number(req.headers.get("content-length") ?? 0) > MAX_GLB_BYTES) throw new AppError("VALIDATION", "errors.upload.tooLarge");
  return putGlbDirect(actor, id, key, Buffer.from(await req.arrayBuffer()));
});
