import { api, jsonBody } from "@/server/http";
import { addToCart } from "@/server/modules/shop/cart.service";
import { cartIdentity, rememberGuestToken } from "@/server/modules/shop/cart-session";

/**
 * POST /api/v1/cart/items — `{ productId, deviceModelId?, quantity }`.
 * Guests without a cart receive `cartToken`; mobile apps send it back as `X-Cart-Token` (web uses the cookie).
 */
export const POST = api(async (req, _ctx, actor) => {
  const { cart, issuedToken } = await addToCart(await cartIdentity(actor), await jsonBody(req));
  await rememberGuestToken(issuedToken);
  return { ...cart, cartToken: issuedToken };
});
