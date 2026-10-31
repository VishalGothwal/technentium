import { api, jsonBody } from "@/server/http";
import { setPublishState } from "@/server/modules/content/content.admin";

/**
 * POST /api/v1/admin/content/articles/{id}/publish — `{ locale, action: publish|schedule|unpublish|archive, scheduledAt? }`.
 * Requires content.publish (FR-CMS-09); each language is published independently (FR-CMS-04).
 */
export const POST = api<RouteContext<"/api/v1/admin/content/articles/[id]/publish">>(async (req, ctx, actor) => setPublishState(actor, (await ctx.params).id, await jsonBody(req)));
