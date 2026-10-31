import { api } from "@/server/http";
import { AppError } from "@/server/errors";
import { checkCompatibility, productsForDevice } from "@/server/modules/shop/catalog.service";

/**
 * GET /api/v1/products/compatibility?deviceModelId=&productId= — public.
 * With `productId`: `{ compatible, universal, note }`. Without: products that fit the device.
 */
export const GET = api(async (req) => {
  const sp = req.nextUrl.searchParams;
  const deviceModelId = sp.get("deviceModelId");
  if (!deviceModelId) throw new AppError("VALIDATION", "errors.validation", { fields: { deviceModelId: "validation.required" } });
  const productId = sp.get("productId");
  return productId ? checkCompatibility(productId, deviceModelId) : productsForDevice(deviceModelId);
});
