import { ApiError } from "../api/client";
import { hasTranslation, t } from "../i18n";

/**
 * Maps the API's stable error codes onto translated messages, falling back to
 * a generic one for codes the caller does not know about. The API's `message`
 * is a developer hint and is never shown to a user.
 */
export function messageFor(
  error: unknown,
  fallback: "auth.error.generic" | "common.error" = "auth.error.generic",
): string {
  if (error instanceof ApiError) {
    const key = `auth.error.${error.code}`;
    if (hasTranslation(key)) return t(key);
  }
  return t(fallback);
}
