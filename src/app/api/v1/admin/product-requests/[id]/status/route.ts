import { z } from "zod";
import { api, jsonBody } from "@/server/http";
import { parse } from "@/server/validation";
import { completeProductRequest, shipProductRequest, staffCancelProductRequest, startFulfilment } from "@/server/modules/shop/request.service";

const bodySchema = z.looseObject({ status: z.enum(["FULFILLING", "SHIPPED", "COMPLETED", "CANCELLED"]) });

/**
 * POST /api/v1/admin/product-requests/{id}/status — `{ status }` plus `trackingInfo` for SHIPPED or `reason` for CANCELLED.
 * FULFILLING decrements stock atomically and fails with CONFLICT if any line lacks stock.
 */
export const POST = api<RouteContext<"/api/v1/admin/product-requests/[id]/status">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  const body = await jsonBody(req);
  const { status } = parse(bodySchema, body);
  if (status === "FULFILLING") return startFulfilment(actor, id);
  if (status === "SHIPPED") return shipProductRequest(actor, id, body);
  if (status === "COMPLETED") return completeProductRequest(actor, id);
  return staffCancelProductRequest(actor, id, body);
});
