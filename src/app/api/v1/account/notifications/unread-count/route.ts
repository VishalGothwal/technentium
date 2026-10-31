import { api } from "@/server/http";
import { unreadCount } from "@/server/modules/account/account.service";

/** GET /api/v1/account/notifications/unread-count — badge count for the app icon/tab bar. */
export const GET = api(async (_req, _ctx, actor) => unreadCount(actor));
