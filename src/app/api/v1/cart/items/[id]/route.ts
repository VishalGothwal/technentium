import { api, jsonBody } from "@/server/http";
import { removeCartItem, updateCartItem } from "@/server/modules/shop/cart.service";
import { cartIdentity } from "@/server/modules/shop/cart-session";

/** PATCH /api/v1/cart/items/{id} — `{ quantity }` (1–10). */
export const PATCH = api<RouteContext<"/api/v1/cart/items/[id]">>(async (req, ctx, actor) => {
  const { id } = await ctx.params;
  return updateCartItem(await cartIdentity(actor), id, await jsonBody(req));
});

/** DELETE /api/v1/cart/items/{id} */
export const DELETE = api<RouteContext<"/api/v1/cart/items/[id]">>(async (_req, ctx, actor) => {
  const { id } = await ctx.params;
  return removeCartItem(await cartIdentity(actor), id);
});
