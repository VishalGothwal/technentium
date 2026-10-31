import type { z } from "zod";
import { AppError } from "@/server/errors";

/** Parse input with a shared schema; on failure throw VALIDATION with field → message-key map. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  throw new AppError("VALIDATION", "errors.validation", { fields });
}
