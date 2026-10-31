import { api } from "@/server/http";
import { notFound } from "@/server/errors";
import { getDeviceModel } from "@/server/modules/catalog/catalog.service";

/** GET /api/v1/devices/models/{id} — public; model with brand and category. */
export const GET = api<RouteContext<"/api/v1/devices/models/[id]">>(async (_req, ctx) => {
  const { id } = await ctx.params;
  return (await getDeviceModel(id)) ?? Promise.reject(notFound("device"));
});
