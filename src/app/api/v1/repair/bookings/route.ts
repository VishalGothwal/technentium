import { api, jsonBody } from "@/server/http";
import { AppError } from "@/server/errors";
import { listMyBookings, submitBooking } from "@/server/modules/repairs/booking.service";

/** GET /api/v1/repair/bookings — the signed-in customer's bookings. */
export const GET = api(async (_req, _ctx, actor) => listMyBookings(actor));

/**
 * POST /api/v1/repair/bookings — submit a booking.
 * Requires an `Idempotency-Key` header; a retry with the same key returns the original booking.
 */
export const POST = api(async (req, _ctx, actor) => {
  const key = req.headers.get("idempotency-key");
  if (!key) throw new AppError("VALIDATION", "errors.validation", { fields: { idempotencyKey: "validation.required" } });
  const result = await submitBooking(actor, await jsonBody(req), key);
  return Response.json({ data: result }, { status: result.duplicate ? 200 : 201 });
});
