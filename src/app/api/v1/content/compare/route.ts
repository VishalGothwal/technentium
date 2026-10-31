import { api } from "@/server/http";
import { AppError } from "@/server/errors";
import { alignSpecs } from "@/lib/content/specs";
import { getCompare } from "@/server/modules/content/content.public";
import { idList, publicJson } from "@/server/modules/content/api-helpers";

/** GET /api/v1/content/compare?ids=a,b[,c] — ad hoc comparison by spec id, spec slug or device model id. */
export const GET = api(async (req) => {
  const ids = idList(req.nextUrl.searchParams.get("ids"), 4);
  if (new Set(ids).size < 2 || ids.length > 3) throw new AppError("VALIDATION", "errors.validation", { fields: { ids: "compare.validation.devices" } });
  const devices = await getCompare(ids);
  return publicJson({ devices, rows: alignSpecs(devices.map((d) => d.specs)) });
});
