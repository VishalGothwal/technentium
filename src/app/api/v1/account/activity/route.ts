import { api } from "@/server/http";
import { requestLocale } from "@/server/request-locale";
import { listActivity } from "@/server/modules/account/account.service";

/** GET /api/v1/account/activity?limit= — repairs, product orders and design requests in one feed. */
export const GET = api(async (req, _ctx, actor) => listActivity(actor, requestLocale(req), Number(req.nextUrl.searchParams.get("limit") ?? 20) || 20));
