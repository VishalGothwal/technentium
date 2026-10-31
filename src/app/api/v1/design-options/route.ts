import { api } from "@/server/http";
import { listDesignOptions } from "@/server/modules/customization/customization.service";

/** GET /api/v1/design-options — active finishes and coverages with price deltas (FR-CUSTOM-03). */
export const GET = api(async () => listDesignOptions());
