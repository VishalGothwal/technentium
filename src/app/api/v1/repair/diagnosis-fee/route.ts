import { api } from "@/server/http";
import { previewDiagnosisFee } from "@/server/modules/catalog/catalog.service";

/** GET /api/v1/repair/diagnosis-fee?modelId=&issueTypeIds=a,b — public; same rule the booking stores (FR-QUOTE-11). */
export const GET = api(async (req) => {
  const modelId = req.nextUrl.searchParams.get("modelId") ?? "";
  const issueTypeIds = (req.nextUrl.searchParams.get("issueTypeIds") ?? "").split(",").filter(Boolean).slice(0, 8);
  return previewDiagnosisFee(modelId, issueTypeIds);
});
