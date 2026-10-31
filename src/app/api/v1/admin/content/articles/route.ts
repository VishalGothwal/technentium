import type { ContentStatus, ContentType } from "@/generated/prisma/client";
import { api, jsonBody } from "@/server/http";
import { createContent, listContentAdmin } from "@/server/modules/content/content.admin";

const TYPES: readonly string[] = ["ARTICLE", "VIDEO"];
const STATUSES: readonly string[] = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"];

/** GET /api/v1/admin/content/articles?type=&status=&locale=&topic=&q=&page= — CMS list (content.edit). */
export const GET = api(async (req, _ctx, actor) => {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") ?? "";
  const status = sp.get("status") ?? "";
  const locale = sp.get("locale");
  return listContentAdmin(actor, {
    type: TYPES.includes(type) ? (type as ContentType) : undefined,
    status: STATUSES.includes(status) ? (status as ContentStatus) : undefined,
    locale: locale === "en" || locale === "hi" ? locale : undefined,
    topic: sp.get("topic")?.slice(0, 40) || undefined,
    q: sp.get("q")?.slice(0, 100) || undefined,
    page: Number(sp.get("page") ?? 1) || 1,
  });
});

/** POST /api/v1/admin/content/articles — create an article or video with its first translation, as a draft. */
export const POST = api(async (req, _ctx, actor) => createContent(actor, await jsonBody(req)));
