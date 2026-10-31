import { api } from "@/server/http";
import { listMyCustomizations } from "@/server/modules/customization/customization.service";

/** GET /api/v1/account/customization-requests — the signed-in customer's design requests. */
export const GET = api(async (_req, _ctx, actor) => listMyCustomizations(actor));
