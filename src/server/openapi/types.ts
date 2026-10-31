/** Minimal OpenAPI 3.1 typing — enough to keep path definitions consistent across sections. */
export type SchemaObject = Record<string, unknown>;
export type OperationObject = {
  tags: string[];
  summary: string;
  description?: string;
  /** "bearer" = signed-in customer (cookie or `Authorization: Bearer <token>`); "staff" = staff permission required. */
  security?: "public" | "bearer" | "staff";
  parameters?: { name: string; in: "query" | "path" | "header"; required?: boolean; schema: SchemaObject; description?: string }[];
  requestBody?: { contentType?: "application/json" | "multipart/form-data"; schema: SchemaObject };
  response?: SchemaObject;
};
export type PathsObject = Record<string, Partial<Record<"get" | "post" | "put" | "patch" | "delete", OperationObject>>>;
