import { api } from "@/server/http";
import { cachedDeviceCatalog } from "@/server/modules/catalog/devices.cached";

/** GET /api/v1/devices/catalog?category=phone — public; every active brand with its models (cached). */
export const GET = api(async (req) => cachedDeviceCatalog(req.nextUrl.searchParams.get("category") ?? "phone"));
