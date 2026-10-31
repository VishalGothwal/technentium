import { z } from "zod";
import type { SchemaObject } from "./types";

/**
 * JSON Schema for a request body, generated from the same Zod schema the service validates with,
 * so the docs cannot drift from the server. Refinements that JSON Schema cannot express are dropped.
 */
export const fromZod = (schema: z.ZodType): SchemaObject => {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as SchemaObject;
  delete json.$schema;
  return json;
};

/** Small builders for response schemas. */
export const obj = (properties: Record<string, SchemaObject>, required?: string[]): SchemaObject => ({ type: "object", properties, ...(required ? { required } : {}) });
export const arr = (items: SchemaObject): SchemaObject => ({ type: "array", items });
export const str = (description?: string, extra: SchemaObject = {}): SchemaObject => ({ type: "string", ...(description ? { description } : {}), ...extra });
export const int = (description?: string): SchemaObject => ({ type: "integer", ...(description ? { description } : {}) });
export const bool = (description?: string): SchemaObject => ({ type: "boolean", ...(description ? { description } : {}) });
export const dateTime = (description?: string): SchemaObject => str(description, { format: "date-time" });
export const nullable = (s: SchemaObject): SchemaObject => ({ anyOf: [s, { type: "null" }] });
export const ref = (name: string): SchemaObject => ({ $ref: `#/components/schemas/${name}` });

export const pathId = (name = "id", description?: string) => ({ name, in: "path" as const, required: true, schema: str(), description });
export const query = (name: string, schema: SchemaObject = str(), description?: string, required = false) => ({ name, in: "query" as const, required, schema, description });
