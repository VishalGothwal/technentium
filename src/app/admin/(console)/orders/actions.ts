"use server";
/** Admin actions for product order requests. Services authorise (`product_request.manage`). */
import { runAction } from "@/server/actions";
import {
  addProductRequestNote,
  completeProductRequest,
  confirmProductRequest,
  declineProductRequest,
  shipProductRequest,
  staffCancelProductRequest,
  startFulfilment,
} from "@/server/modules/shop/request.service";

export async function confirmOrderAction(id: string, input: { shippingPaise: number; items: { id: string; confirmedQuantity: number }[]; message: string }) {
  return runAction((actor) => confirmProductRequest(actor, id, input));
}

export async function declineOrderAction(id: string, reason: string) {
  return runAction((actor) => declineProductRequest(actor, id, { reason }));
}

export async function cancelOrderStaffAction(id: string, reason: string) {
  return runAction((actor) => staffCancelProductRequest(actor, id, { reason }));
}

export async function startFulfilmentAction(id: string) {
  return runAction((actor) => startFulfilment(actor, id));
}

export async function shipOrderAction(id: string, trackingInfo: string) {
  return runAction((actor) => shipProductRequest(actor, id, { trackingInfo }));
}

export async function completeOrderAction(id: string) {
  return runAction((actor) => completeProductRequest(actor, id));
}

export async function addOrderNoteAction(id: string, body: string, customerVisible: boolean) {
  return runAction((actor) => addProductRequestNote(actor, id, { body, customerVisible }));
}
