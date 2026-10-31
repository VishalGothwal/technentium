import { NextResponse } from "next/server";
import { api, jsonBody } from "@/server/http";
import { submitProductRequest } from "@/server/modules/shop/request.service";

/**
 * POST /api/v1/product-requests — submit the signed-in customer's cart as an order request.
 * Requires an `Idempotency-Key` header (16–64 chars); a retry returns the original reference.
 * The result is a request, not a paid or confirmed order (FR-PROD-13).
 */
export const POST = api(async (req, _ctx, actor) => {
  const result = await submitProductRequest(actor, await jsonBody(req), req.headers.get("idempotency-key") ?? "");
  return NextResponse.json({ data: result }, { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
});
