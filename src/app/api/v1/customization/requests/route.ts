import { api, jsonBody } from "@/server/http";
import { AppError } from "@/server/errors";
import { submitCustomization } from "@/server/modules/customization/customization.service";

/**
 * POST /api/v1/customization/requests — submit a design request (sign-in required, FR-CUSTOM-07).
 * Requires an `Idempotency-Key` header; a retry with the same key returns the original request.
 */
export const POST = api(async (req, _ctx, actor) => {
  const key = req.headers.get("idempotency-key");
  if (!key) throw new AppError("VALIDATION", "errors.validation", { fields: { idempotencyKey: "validation.required" } });
  const result = await submitCustomization(actor, await jsonBody(req), key);
  return Response.json({ data: result }, { status: result.duplicate ? 200 : 201 });
});
