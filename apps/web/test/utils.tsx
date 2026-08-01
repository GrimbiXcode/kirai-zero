import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, type RenderResult } from "@testing-library/react";
import { vi } from "vitest";

type Handler = (url: URL, init: RequestInit | undefined) => unknown;

/**
 * Stubs `fetch` at the network boundary rather than mocking the query hooks,
 * so the tests exercise the real client, the real cache behaviour and the real
 * component code — only the server is fake.
 */
export function mockApi(routes: Record<string, Handler>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const key = `${init?.method ?? "GET"} ${url.pathname}`;
      const handler =
        routes[key] ??
        routes[
          Object.keys(routes).find((candidate) => {
            const [method, pattern] = candidate.split(" ");
            if (method !== (init?.method ?? "GET")) return false;
            return (
              pattern !== undefined &&
              pattern.endsWith("*") &&
              url.pathname.startsWith(pattern.slice(0, -1))
            );
          }) ?? ""
        ];

      if (!handler) {
        return new Response(
          JSON.stringify({ error: "not_found", message: key }),
          { status: 404, headers: { "content-type": "application/json" } },
        );
      }
      const body = handler(url, init);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/" }: { route?: string } = {},
): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

export function preference(overrides: Record<string, unknown> = {}) {
  return {
    id: "pref-1",
    item: {
      id: "item-1",
      slug: "koriander",
      name: "Koriander",
      kind: "ingredient",
      isCurated: true,
    },
    stance: "avoid",
    reason: "taste",
    note: null,
    visibility: "friends",
    consentedAt: null,
    consentVersion: null,
    updatedAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}
