import { z } from "zod";
import { api, jsonBody } from "@/server/http";
import { parse } from "@/server/validation";
import { confirmProductRequest, declineProductRequest } from "@/server/modules/shop/request.service";

const bodySchema = z.looseObject({ decision: z.enum(["confirm", "decline"]) });

/**
 * POST /api/v1/admin/product-requests/{id}/review
 * `{ decision: "confirm", shippingPaise, items: [{ id, confirmedQuantity }], message? }` or `{ decision: "decline", reason }`.
 */
export const POST = api<RouteContext<"/api/v1/admin/product-requests/[id]/review">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  const body = await jsonBody(req);
  const { decision } = parse(bodySchema, body);
  return decision === "confirm" ? confirmProductRequest(actor, id, body) : declineProductRequest(actor, id, body);
});
