import { api, jsonBody } from "@/server/http";
import { markNotificationsRead } from "@/server/modules/account/account.service";

/** POST /api/v1/account/notifications/read — `{ ids: string[] }` or `{ all: true }`. */
export const POST = api(async (req, _ctx, actor) => markNotificationsRead(actor, await jsonBody(req)));
