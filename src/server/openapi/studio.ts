import type { PathsObject, SchemaObject } from "./types";

/** OpenAPI paths for the customization section (PRD §11.5). */

const STATUSES = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO", "FEASIBILITY_CONFIRMED", "QUOTE_SHARED", "ACCEPTED", "DECLINED", "COMPLETED", "CANCELLED"];
const hex = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };

const style: SchemaObject = {
  type: "object",
  properties: {
    pattern: { type: "string", enum: ["solid", "gradient", "waves", "grid", "dots", "stripes", "topo", "blobs", "chevron", "terrazzo", "sunburst", "checker", "letters"] },
    palette: { type: "array", items: hex, minItems: 2, maxItems: 5, description: "First colour is the background." },
    density: { type: "integer", minimum: 1, maximum: 10 },
    angle: { type: "integer", minimum: 0, maximum: 360 },
  },
};

const design: SchemaObject = {
  type: "object",
  properties: {
    id: { type: "string" },
    slug: { type: "string" },
    nameEn: { type: "string" },
    nameHi: { type: ["string", "null"] },
    descriptionEn: { type: ["string", "null"] },
    descriptionHi: { type: ["string", "null"] },
    collection: { type: "string", enum: ["minimal", "nature", "abstract", "gradient", "typography", "retro"] },
    style,
    basePricePaise: { type: ["integer", "null"], description: "Null → default blank price." },
    featured: { type: "boolean" },
  },
};

const option: SchemaObject = {
  type: "object",
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: ["FINISH", "COVERAGE"] },
    slug: { type: "string", description: "finish: matte|gloss|metallic|carbon|leather; coverage: back|camera|sides|full" },
    nameEn: { type: "string" },
    nameHi: { type: ["string", "null"] },
    priceDeltaPaise: { type: "integer" },
  },
};

const requestBody: SchemaObject = {
  type: "object",
  required: ["deviceModelId", "finishOptionId", "coverageOptionId", "acceptTerms"],
  properties: {
    deviceModelId: { type: "string", description: "Phone, tablet or laptop model (see /devices/search)." },
    designId: { type: ["string", "null"], description: "Null for a blank canvas." },
    finishOptionId: { type: "string" },
    coverageOptionId: { type: "string" },
    palette: { type: "array", items: hex, minItems: 2, maxItems: 5 },
    text: {
      type: ["object", "null"],
      properties: {
        value: { type: "string", maxLength: 24 },
        font: { type: "string", enum: ["sans", "serif", "mono", "script", "display"] },
        position: { type: "string", enum: ["top", "center", "bottom"] },
        color: hex,
      },
    },
    artwork: {
      type: ["object", "null"],
      description: "Upload first via POST /media with purpose CUSTOM_ARTWORK; only your own unattached upload is accepted.",
      properties: { mediaId: { type: "string" }, scale: { type: "number", minimum: 0.2, maximum: 2 }, x: { type: "number", minimum: -1, maximum: 1 }, y: { type: "number", minimum: -1, maximum: 1 } },
    },
    notes: { type: "string", maxLength: 1000 },
    acceptTerms: { type: "boolean", const: true },
  },
};

const summary: SchemaObject = {
  type: "object",
  properties: {
    reference: { type: "string", example: "TN-C-2610-00001" },
    status: { type: "string", enum: STATUSES },
    configuration: { type: "object", description: "Snapshot as previewed: device, design, style, finish, coverage, text, artwork, estimate." },
    estimatePaise: { type: ["integer", "null"] },
    quotedPaise: { type: ["integer", "null"] },
    createdAt: { type: "string", format: "date-time" },
  },
};

const referenceParam = { name: "reference", in: "path" as const, required: true, schema: { type: "string" } };
const idParam = { name: "id", in: "path" as const, required: true, schema: { type: "string" } };

export const paths: PathsObject = {
  "/api/v1/designs": {
    get: {
      tags: ["Customization"],
      summary: "List designs",
      security: "public",
      parameters: [{ name: "collection", in: "query", schema: { type: "string" } }],
      response: { type: "array", items: design },
    },
  },
  "/api/v1/designs/{id}": {
    get: { tags: ["Customization"], summary: "Get a design by id or slug", security: "public", parameters: [idParam], response: design },
  },
  "/api/v1/design-options": {
    get: {
      tags: ["Customization"],
      summary: "Active finishes and coverage options with price add-ons",
      security: "public",
      response: { type: "object", properties: { finishes: { type: "array", items: option }, coverages: { type: "array", items: option } } },
    },
  },
  "/api/v1/customization/requests": {
    post: {
      tags: ["Customization"],
      summary: "Submit a design request",
      description: "Requires the `Idempotency-Key` header (16–64 chars). 201 on create, 200 with `duplicate: true` on retry. Not an order: staff confirm feasibility and price.",
      security: "bearer",
      parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } }],
      requestBody: { schema: requestBody },
      response: { type: "object", properties: { reference: { type: "string" }, duplicate: { type: "boolean" } } },
    },
  },
  "/api/v1/account/customization-requests": {
    get: { tags: ["Customization"], summary: "My design requests", security: "bearer", response: { type: "array", items: summary } },
  },
  "/api/v1/account/customization-requests/{reference}": {
    get: {
      tags: ["Customization"],
      summary: "My design request with customer-visible history, notes and artwork ids",
      security: "bearer",
      parameters: [referenceParam],
      response: summary,
    },
  },
  "/api/v1/account/customization-requests/{reference}/reply": {
    post: {
      tags: ["Customization"],
      summary: "Answer a request for more information (NEEDS_INFO → UNDER_REVIEW)",
      security: "bearer",
      parameters: [referenceParam],
      requestBody: { schema: { type: "object", required: ["message"], properties: { message: { type: "string", maxLength: 1000 } } } },
    },
  },
  "/api/v1/account/customization-requests/{reference}/decision": {
    post: {
      tags: ["Customization"],
      summary: "Accept or decline the shared price (QUOTE_SHARED only)",
      security: "bearer",
      parameters: [referenceParam],
      requestBody: { schema: { type: "object", required: ["decision"], properties: { decision: { type: "string", enum: ["ACCEPT", "DECLINE"] }, reason: { type: "string", maxLength: 500 } } } },
      response: { type: "object", properties: { status: { type: "string", enum: ["ACCEPTED", "DECLINED"] } } },
    },
  },
  "/api/v1/account/customization-requests/{reference}/cancel": {
    post: {
      tags: ["Customization"],
      summary: "Cancel before a price is shared",
      security: "bearer",
      parameters: [referenceParam],
      requestBody: { schema: { type: "object", properties: { reason: { type: "string", maxLength: 500 } } } },
    },
  },
  "/api/v1/admin/customization-requests": {
    get: {
      tags: ["Customization (staff)"],
      summary: "Request queue",
      security: "staff",
      description: "Permission: customization.manage or customization.technical_input.",
      parameters: [
        { name: "status", in: "query", schema: { type: "string", enum: ["OPEN", ...STATUSES] } },
        { name: "q", in: "query", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
      ],
    },
  },
  "/api/v1/admin/customization-requests/{id}": {
    get: { tags: ["Customization (staff)"], summary: "Full request with history and all notes", security: "staff", parameters: [idParam] },
  },
  "/api/v1/admin/customization-requests/{id}/status": {
    post: {
      tags: ["Customization (staff)"],
      summary: "Change status",
      description: "Permission: customization.manage. Reason required for NEEDS_INFO, DECLINED and CANCELLED. The customer is notified.",
      security: "staff",
      parameters: [idParam],
      requestBody: {
        schema: { type: "object", required: ["to"], properties: { to: { type: "string", enum: ["UNDER_REVIEW", "NEEDS_INFO", "FEASIBILITY_CONFIRMED", "COMPLETED", "DECLINED", "CANCELLED"] }, reason: { type: "string" } } },
      },
    },
  },
  "/api/v1/admin/customization-requests/{id}/quote": {
    post: {
      tags: ["Customization (staff)"],
      summary: "Share or revise the price (→ QUOTE_SHARED)",
      security: "staff",
      parameters: [idParam],
      requestBody: { schema: { type: "object", required: ["quotedPaise"], properties: { quotedPaise: { type: "integer", minimum: 0 }, message: { type: "string" } } } },
    },
  },
  "/api/v1/admin/customization-requests/{id}/notes": {
    post: {
      tags: ["Customization (staff)"],
      summary: "Add a note",
      description: "INTERNAL notes need customization.manage or customization.technical_input; CUSTOMER notes need customization.manage and notify the customer.",
      security: "staff",
      parameters: [idParam],
      requestBody: { schema: { type: "object", required: ["body", "visibility"], properties: { body: { type: "string" }, visibility: { type: "string", enum: ["INTERNAL", "CUSTOMER"] } } } },
    },
  },
};
