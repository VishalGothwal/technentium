import { api } from "@/server/http";
import { listConsents } from "@/server/modules/account/account.service";

/** GET /api/v1/account/consents — consent history (terms/privacy versions accepted). */
export const GET = api(async (_req, _ctx, actor) => listConsents(actor));
