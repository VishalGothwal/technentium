import { api } from "@/server/http";
import { listDesigns } from "@/server/modules/customization/customization.service";

/** GET /api/v1/designs?collection= — public design catalogue (FR-CUSTOM-02). */
export const GET = api(async (req) => listDesigns({ collection: req.nextUrl.searchParams.get("collection") }));
