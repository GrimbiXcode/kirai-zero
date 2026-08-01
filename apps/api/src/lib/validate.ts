import type { ZodType } from "zod";
import { badRequest } from "./errors";

/**
 * Validates untrusted input against a schema shared with the client, so both
 * sides accept exactly the same shapes. Zod issues are passed through as
 * `details` — they are field paths and codes, never the submitted values, so
 * nothing sensitive ends up in an error response or a log line.
 */
export function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(
      "validation_failed",
      "Request payload is invalid",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
    );
  }
  return result.data;
}
