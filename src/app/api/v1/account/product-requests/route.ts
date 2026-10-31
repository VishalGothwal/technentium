import { api } from "@/server/http";
import { listMyProductRequests } from "@/server/modules/shop/request.service";

/** GET /api/v1/account/product-requests — the signed-in customer's order requests, newest first. */
export const GET = api(async (_req, _ctx, actor) => listMyProductRequests(actor));
