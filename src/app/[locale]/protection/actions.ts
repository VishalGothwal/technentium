"use server";
import { runAction } from "@/server/actions";
import { addToCart, removeCartItem, updateCartItem } from "@/server/modules/shop/cart.service";
import { cartIdentity, rememberGuestToken } from "@/server/modules/shop/cart-session";
import { checkCompatibility } from "@/server/modules/shop/catalog.service";
import { cancelMyProductRequest, submitProductRequest } from "@/server/modules/shop/request.service";

/** Store actions: thin wrappers — services validate input and authorise. */

export async function addToCartAction(input: { productId: string; deviceModelId?: string | null; quantity: number }) {
  return runAction(async (actor) => {
    const { cart, issuedToken } = await addToCart(await cartIdentity(actor), input);
    await rememberGuestToken(issuedToken);
    return { count: cart.count };
  });
}

export async function updateCartItemAction(itemId: string, quantity: number) {
  return runAction(async (actor) => {
    const cart = await updateCartItem(await cartIdentity(actor), itemId, { quantity });
    return { count: cart.count };
  });
}

export async function removeCartItemAction(itemId: string) {
  return runAction(async (actor) => {
    const cart = await removeCartItem(await cartIdentity(actor), itemId);
    return { count: cart.count };
  });
}


export async function checkFitAction(productId: string, deviceModelId: string) {
  return runAction(() => checkCompatibility(productId, deviceModelId), { refresh: false });
}

export async function submitOrderAction(input: unknown, idempotencyKey: string) {
  return runAction((actor) => submitProductRequest(actor, input, idempotencyKey));
}

export async function cancelOrderAction(reference: string) {
  return runAction((actor) => cancelMyProductRequest(actor, reference));
}
