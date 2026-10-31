import type { ProductRequestStatus } from "@/generated/prisma/enums";
import { api } from "@/server/http";
import { listProductRequestsForStaff } from "@/server/modules/shop/request.service";

const FILTERS = ["OPEN", "ALL", "SUBMITTED", "CONFIRMED", "FULFILLING", "SHIPPED", "COMPLETED", "DECLINED", "CANCELLED"] as const;

/** GET /api/v1/admin/product-requests?status=&q=&page= — staff queue (`product_request.manage`). */
export const GET = api(async (req, _ctx, actor) => {
  const sp = req.nextUrl.searchParams;
  const status = (FILTERS as readonly string[]).includes(sp.get("status") ?? "") ? (sp.get("status") as ProductRequestStatus | "OPEN" | "ALL") : "OPEN";
  return listProductRequestsForStaff(actor, { status, q: sp.get("q")?.slice(0, 60) || undefined, page: Number(sp.get("page")) || 1 });
});
