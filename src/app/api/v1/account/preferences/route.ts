import { api, jsonBody } from "@/server/http";
import { getPreferences, updatePreferences } from "@/server/modules/account/account.service";

/** GET /api/v1/account/preferences — notification channels (in-app is always on). */
export const GET = api(async (_req, _ctx, actor) => getPreferences(actor));

/** PUT /api/v1/account/preferences — `{ channels: [{ channel: "email"|"sms"|"whatsapp", enabled }] }`. */
export const PUT = api(async (req, _ctx, actor) => updatePreferences(actor, await jsonBody(req)));
