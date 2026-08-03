import type { FastifyInstance } from "fastify";
import { sql as raw } from "drizzle-orm";
import { buildApp } from "../src/app";
import { createDatabase } from "../src/db/client";
import { loadEnv } from "../src/env";
import { memoryMailer, type MemoryMailer } from "../src/lib/mail";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/kirai_test";

export const TEST_APP_URL = "http://localhost:5173";

export interface TestContext {
  app: FastifyInstance;
  /** Every message the app tried to send, in order. */
  mailer: MemoryMailer;
  close: () => Promise<void>;
}

export interface TestAppOptions {
  /** Off by default: the suites register far more accounts from one address
   *  than a real user ever would. One dedicated test turns it back on. */
  rateLimit?: boolean;
}

export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestContext> {
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: TEST_DATABASE_URL,
    CORS_ORIGINS: "http://localhost:5173",
    COOKIE_SECURE: "false",
    RATE_LIMIT_ENABLED: options.rateLimit ? "true" : "false",
    // No SMTP_HOST: nothing leaves the process. APP_URL still has to be right,
    // because the links in the captured mails are what the tests follow.
    APP_URL: TEST_APP_URL,
    SUPPORT_EMAIL: "hilfe@example.org",
  });
  const { db, sql } = createDatabase(TEST_DATABASE_URL, 5);
  const mailer = memoryMailer();
  const app = await buildApp({ db, env, mailer });
  await app.ready();
  return {
    app,
    mailer,
    close: async () => {
      await app.close();
      await sql.end();
    },
  };
}

/**
 * Wipes user-generated rows but keeps the seeded catalogue.
 *
 * Deliberately not `TRUNCATE ... CASCADE` on `users`: because `items.created_by`
 * references users, cascading would empty the catalogue along with it. Deleting
 * dependents first and users last keeps the seed intact.
 */
export async function resetData(app: FastifyInstance): Promise<void> {
  await app.db.execute(
    raw`TRUNCATE TABLE sessions, email_tokens, preferences, friend_requests, friendships`,
  );
  await app.db.execute(raw`DELETE FROM items WHERE is_curated = false`);
  await app.db.execute(raw`DELETE FROM users`);
}

export interface TestUser {
  id: string;
  handle: string;
  email: string;
  token: string;
  auth: { authorization: string };
}

let handleCounter = 0;

export async function registerUser(
  app: FastifyInstance,
  overrides: Partial<{ handle: string; email: string; password: string }> = {},
): Promise<TestUser> {
  handleCounter += 1;
  const handle = overrides.handle ?? `tester${handleCounter}`;
  const email = overrides.email ?? `${handle}@example.org`;
  const password = overrides.password ?? "correct horse battery";

  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { handle, email, displayName: handle, password },
  });
  if (response.statusCode !== 201) {
    throw new Error(`register failed: ${response.statusCode} ${response.body}`);
  }
  const body = response.json() as { user: { id: string }; token: string };
  return {
    id: body.user.id,
    handle,
    email,
    token: body.token,
    auth: { authorization: `Bearer ${body.token}` },
  };
}

/** Makes two users friends through the real request/accept endpoints. */
export async function befriend(
  app: FastifyInstance,
  a: TestUser,
  b: TestUser,
): Promise<void> {
  const created = await app.inject({
    method: "POST",
    url: "/api/friend-requests",
    headers: a.auth,
    payload: { handle: b.handle },
  });
  if (created.statusCode !== 201) {
    throw new Error(`request failed: ${created.statusCode} ${created.body}`);
  }
  const requestId = (created.json() as { request: { id: string } }).request.id;

  const accepted = await app.inject({
    method: "POST",
    url: `/api/friend-requests/${requestId}/accept`,
    headers: b.auth,
  });
  if (accepted.statusCode !== 200) {
    throw new Error(`accept failed: ${accepted.statusCode} ${accepted.body}`);
  }
}

export async function findItemId(
  app: FastifyInstance,
  user: TestUser,
  query: string,
): Promise<string> {
  const response = await app.inject({
    method: "GET",
    url: `/api/items?q=${encodeURIComponent(query)}&limit=1`,
    headers: user.auth,
  });
  const body = response.json() as { items: { id: string }[] };
  const item = body.items[0];
  if (!item) throw new Error(`no item found for "${query}"`);
  return item.id;
}

export async function setPreference(
  app: FastifyInstance,
  user: TestUser,
  itemId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await app.inject({
    method: "PUT",
    url: `/api/me/preferences/${itemId}`,
    headers: user.auth,
    payload,
  });
  if (response.statusCode !== 200) {
    throw new Error(`set preference failed: ${response.body}`);
  }
}
