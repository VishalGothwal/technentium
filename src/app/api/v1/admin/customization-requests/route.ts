import type { CustomizationStatus } from "@/generated/prisma/enums";
import { api } from "@/server/http";
import { listCustomizationsForStaff } from "@/server/modules/customization/customization.service";

/** GET /api/v1/admin/customization-requests?status=&q=&page= — request queue for staff. */
export const GET = api(async (req, _ctx, actor) => {
  const sp = req.nextUrl.searchParams;
  return listCustomizationsForStaff(actor, {
    status: (sp.get("status") as CustomizationStatus | "OPEN" | null) ?? undefined,
    q: sp.get("q")?.slice(0, 60) || undefined,
    page: Number(sp.get("page")) || 1,
  });
});
