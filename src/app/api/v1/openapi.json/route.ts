import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/server/openapi/document";
import { SITE_URL } from "@/lib/seo";

/** GET /api/v1/openapi.json — OpenAPI 3.1 description of every public, customer and staff endpoint. */
export function GET() {
  return NextResponse.json(buildOpenApiDocument(SITE_URL), { headers: { "Cache-Control": "public, max-age=300" } });
}
