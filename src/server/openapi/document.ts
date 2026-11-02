import "server-only";
import { API_SECTIONS } from "./index";
import type { OperationObject, PathsObject, SchemaObject } from "./types";

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

export const ERROR_CODES: { status: number; code: string; meaning: string }[] = [
  { status: 401, code: "UNAUTHENTICATED", meaning: "Missing, expired or invalid session/bearer token." },
  { status: 403, code: "FORBIDDEN", meaning: "Signed in, but the role lacks the required permission." },
  { status: 404, code: "NOT_FOUND", meaning: "Does not exist — or belongs to someone else (records are never disclosed across accounts)." },
  { status: 409, code: "CONFLICT", meaning: "The record changed in the meantime. Refresh and retry." },
  { status: 409, code: "INVALID_TRANSITION", meaning: "The requested status change is not allowed from the current status." },
  { status: 409, code: "SLOT_FULL", meaning: "The appointment slot has no capacity left." },
  { status: 409, code: "QUOTE_NOT_ACTIONABLE", meaning: "The quote was superseded, expired or already decided." },
  { status: 422, code: "VALIDATION", meaning: "Invalid input. `fields` maps each invalid field to a localised message." },
  { status: 422, code: "UNSERVICEABLE", meaning: "The pincode is outside the repair service area." },
  { status: 429, code: "RATE_LIMITED", meaning: "Too many requests. Wait and retry." },
  { status: 500, code: "INTERNAL", meaning: "Unexpected server error. Safe to retry idempotent requests." },
];

const STATUSES = [...new Set(ERROR_CODES.map((e) => e.status))];
const describeStatus = (status: number) =>
  ERROR_CODES.filter((e) => e.status === status)
    .map((e) => `${e.code} — ${e.meaning}`)
    .join(" ");

/** Stable operationId: method + path segments, e.g. `get_api_v1_track_reference`. */
export const operationId = (method: string, path: string) =>
  `${method}_${path
    .replace(/^\//, "")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")}`;

export function mergedPaths(): PathsObject {
  const out: PathsObject = {};
  for (const section of API_SECTIONS) for (const [path, item] of Object.entries(section.paths)) out[path] = { ...out[path], ...item };
  return out;
}

const securityFor = (op: OperationObject) => (op.security === "public" ? [] : [{ bearerAuth: [] }, { cookieAuth: [] }]);

function toOperation(method: string, path: string, op: OperationObject) {
  const isAuthEndpoint = path.startsWith("/api/auth/");
  const success: SchemaObject = op.response
    ? { type: "object", properties: { data: op.response }, required: ["data"] }
    : { type: "object", properties: { data: {} } };
  const errors = Object.fromEntries(
    STATUSES.filter((s) => (op.security === "public" ? ![401, 403].includes(s) : op.security === "bearer" ? s !== 403 : true)).map((s) => [
      String(s),
      { $ref: `#/components/responses/Error${s}` },
    ]),
  );
  return {
    operationId: operationId(method, path),
    tags: op.tags,
    summary: op.summary,
    ...(op.description || op.security === "staff"
      ? { description: [op.description, op.security === "staff" ? "Staff only: requires a signed-in staff account with the relevant permission." : null].filter(Boolean).join("\n\n") }
      : {}),
    security: securityFor(op),
    parameters: [{ $ref: "#/components/parameters/AcceptLanguage" }, ...(op.parameters ?? [])],
    ...(op.requestBody ? { requestBody: { required: true, content: { [op.requestBody.contentType ?? "application/json"]: { schema: op.requestBody.schema } } } } : {}),
    responses: {
      "200": {
        description: "Success",
        // Better Auth endpoints return their payload directly; app endpoints wrap it in `{ data }`.
        content: { "application/json": { schema: isAuthEndpoint ? (op.response ?? {}) : success } },
      },
      ...errors,
    },
  };
}

/** OpenAPI 3.1 document assembled from every section's path registry. */
export function buildOpenApiDocument(serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [path, item] of Object.entries(mergedPaths())) {
    paths[path] = {};
    for (const m of METHODS) {
      const op = item[m];
      if (op) paths[path][m] = toOperation(m, path, op);
    }
  }
  const tags = [...new Set(Object.values(mergedPaths()).flatMap((item) => METHODS.flatMap((m) => item[m]?.tags ?? [])))].map((name) => ({ name }));

  return {
    openapi: "3.1.0",
    info: {
      title: "Technentium API",
      version: "1.0.0",
      description:
        "REST API for the Technentium web and mobile apps: device repairs, protection products, customization and content. Responses are JSON wrapped in `{ data }`; errors use `{ error: { code, messageKey, message, fields } }`. Money is integer paise (₹1 = 100). Send `Accept-Language: hi` for Hindi messages and labels.\n\n**Sign-in** uses Supabase Auth directly from the app (URL and publishable key in `GET /api/v1/app/config` → `auth`): `signInWithOtp({ phone })` + `verifyOtp({ phone, token, type: 'sms' })` for mobile numbers (+91), `signInWithPassword`, or Google. Send the session's access token as `Authorization: Bearer <token>`; the first authenticated request links or creates the app account.",
    },
    servers: [{ url: serverUrl }],
    tags,
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Supabase Auth access token (`session.access_token` from supabase-js / supabase-flutter / supabase-kt). The SDK refreshes it; always send the current one.",
        },
        cookieAuth: { type: "apiKey", in: "cookie", name: "sb-<project-ref>-auth-token", description: "Supabase session cookie (web)." },
      },
      parameters: {
        AcceptLanguage: { name: "Accept-Language", in: "header", required: false, schema: { type: "string", enum: ["en", "hi"], default: "en" } },
        IdempotencyKey: { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", maxLength: 100 } },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "messageKey", "message"],
              properties: {
                code: { type: "string", enum: [...new Set(ERROR_CODES.map((e) => e.code))] },
                messageKey: { type: "string" },
                message: { type: "string", description: "Localised, safe to show to the user" },
                fields: { type: "object", additionalProperties: { type: "string" } },
              },
            },
          },
        },
      },
      responses: Object.fromEntries(
        STATUSES.map((s) => [`Error${s}`, { description: describeStatus(s), content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }]),
      ),
    },
  };
}
