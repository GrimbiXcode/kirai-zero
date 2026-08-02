import type { ApiErrorBody } from "shared";
import { loadToken } from "./token";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  readonly status: number;
  /** Stable identifier from the API, used to pick a translated message. */
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const token = await loadToken();
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    // Sends the session cookie on the web build; harmless for the native one,
    // which authenticates with the bearer header above.
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = payload as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      error?.error ?? "request_failed",
      error?.message ?? response.statusText,
    );
  }

  return payload as T;
}

/** Downloads the export as a file without routing it through fetch caching. */
export function exportUrl(): string {
  return `${BASE_URL}/api/me/export`;
}

export { BASE_URL };
