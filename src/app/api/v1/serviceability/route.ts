import { api } from "@/server/http";
import { AppError } from "@/server/errors";
import { enforce } from "@/server/rate-limit";
import { checkServiceability } from "@/server/modules/catalog/catalog.service";
import { isValidPincode } from "@/lib/phone";

/** GET /api/v1/serviceability?pincode= — public, rate-limited per IP. */
export const GET = api(async (req) => {
  const pincode = req.nextUrl.searchParams.get("pincode")?.trim() ?? "";
  if (!isValidPincode(pincode)) throw new AppError("VALIDATION", "validation.pincode");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  await enforce(`pincode:${ip}`, 60, 30);
  return checkServiceability(pincode);
});
