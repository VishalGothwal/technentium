import { api, jsonBody } from "@/server/http";
import { getContentForEdit, updateContent } from "@/server/modules/content/content.admin";

type Ctx = RouteContext<"/api/v1/admin/content/articles/[id]">;

/** GET /api/v1/admin/content/articles/{id} — item, both translations, relations and recent revisions. */
export const GET = api<Ctx>(async (_req, ctx, actor) => getContentForEdit(actor, (await ctx.params).id));

/** PATCH /api/v1/admin/content/articles/{id} — update item fields, per-locale translations and/or relations. */
export const PATCH = api<Ctx>(async (req, ctx, actor) => updateContent(actor, (await ctx.params).id, await jsonBody(req)));
