import { api } from "@/server/http";
import { appConfig } from "@/server/modules/account/app.service";

/** GET /api/v1/app/config — launch configuration for mobile apps (public). */
export const GET = api(async () => appConfig());
