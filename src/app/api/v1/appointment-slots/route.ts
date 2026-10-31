import { api } from "@/server/http";
import { listAvailableSlots } from "@/server/modules/catalog/catalog.service";

/** GET /api/v1/appointment-slots — public, next 7 days. */
export const GET = api(async () => listAvailableSlots(7));
