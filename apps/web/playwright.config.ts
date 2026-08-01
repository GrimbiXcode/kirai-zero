import { defineConfig, devices } from "@playwright/test";

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/kirai_e2e";

const API_PORT = 3100;
const WEB_PORT = 4173;
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

/**
 * Runs the smoke test against the real stack: the built client served as it
 * would be in production, talking to the API over HTTP against its own
 * database. Nothing is stubbed.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Escape hatch for environments that ship a preinstalled Chromium
        // whose build number does not match this Playwright release. Left
        // unset, Playwright uses the browser it manages itself.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
              },
            }
          : {}),
      },
    },
  ],
  webServer: [
    {
      // Migrations, seed and reset run here rather than in a Playwright
      // globalSetup, because Playwright starts web servers first and the API
      // would crash against an empty schema.
      command:
        "pnpm --filter api db:migrate && pnpm --filter api db:seed && pnpm --filter api db:reset && pnpm --filter api dev",
      cwd: "../..",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        PORT: String(API_PORT),
        NODE_ENV: "development",
        CORS_ORIGINS: WEB_URL,
        COOKIE_SECURE: "false",
        // The suite registers several accounts from one address in seconds.
        RATE_LIMIT_ENABLED: "false",
      },
    },
    {
      command: `pnpm build && pnpm exec vite preview --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: false,
      env: { VITE_API_URL: API_URL },
    },
  ],
});

export { E2E_DATABASE_URL };
