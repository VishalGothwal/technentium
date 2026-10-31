"use server";
/** Admin actions for products, stock, categories and types. Services authorise each call; edits refresh the cached store pages. */
import { updateTag } from "next/cache";
import { runAction } from "@/server/actions";
import { PRODUCTS_TAG } from "@/server/modules/shop/catalog.cached";
import { adjustStock, createProduct, saveCategory, saveProductType, updateProduct } from "@/server/modules/shop/product-admin.service";

async function refreshing<T>(fn: () => Promise<T>) {
  const res = await fn();
  updateTag(PRODUCTS_TAG);
  return res;
}

export async function createProductAction(input: unknown) {
  return runAction((actor) => refreshing(() => createProduct(actor, input)));
}

export async function updateProductAction(id: string, input: unknown) {
  return runAction((actor) => refreshing(() => updateProduct(actor, id, input)));
}

export async function adjustStockAction(productId: string, input: { delta: number; reason: string; note: string }) {
  return runAction((actor) => refreshing(() => adjustStock(actor, productId, input)));
}

export async function saveCategoryAction(id: string | null, input: unknown) {
  return runAction((actor) => refreshing(() => saveCategory(actor, id, input)));
}

export async function saveProductTypeAction(id: string | null, input: unknown) {
  return runAction((actor) => refreshing(() => saveProductType(actor, id, input)));
}
