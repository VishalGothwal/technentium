import { api } from "@/server/http";
import { requestLocale } from "@/server/request-locale";
import { homeFeed } from "@/server/modules/account/app.service";

/** GET /api/v1/home — aggregated mobile home feed (public, localised). */
export const GET = api(async (req) => homeFeed(requestLocale(req)));
