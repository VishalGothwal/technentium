import { api } from "@/server/http";
import { requestLocale } from "@/server/request-locale";
import { listNotifications } from "@/server/modules/account/account.service";

/** GET /api/v1/account/notifications?cursor=&limit=&unread=1 — in-app inbox, newest first, cursor-paginated. */
export const GET = api(async (req, _ctx, actor) => {
  const sp = req.nextUrl.searchParams;
  return listNotifications(actor, requestLocale(req), { cursor: sp.get("cursor"), limit: Number(sp.get("limit") ?? 20) || 20, unreadOnly: sp.get("unread") === "1" });
});
