import { api } from "@/server/http";
import { getCart } from "@/server/modules/shop/cart.service";
import { cartIdentity, forgetGuestToken } from "@/server/modules/shop/cart-session";

/**
 * GET /api/v1/cart — the caller's cart (signed-in user, or guest via cookie / `X-Cart-Token`).
 * A guest cart is merged into the user's cart on the first authenticated call.
 */
export const GET = api(async (_req, _ctx, actor) => {
  const cart = await getCart(await cartIdentity(actor));
  if (actor && cart.mergedGuest) await forgetGuestToken();
  return cart;
});
