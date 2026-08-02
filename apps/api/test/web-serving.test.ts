import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { createDatabase } from "../src/db/client";
import { loadEnv } from "../src/env";
import { TEST_DATABASE_URL } from "./helpers";

/**
 * The container image runs one process for both the API and the web client.
 * These tests pin the two rules that make that work: client-side routes get
 * the app shell, and nothing under /api ever does.
 */
let app: FastifyInstance;
let close: () => Promise<void>;

beforeAll(async () => {
  const webRoot = mkdtempSync(join(tmpdir(), "kirai-web-"));
  writeFileSync(join(webRoot, "index.html"), "<!doctype html><title>shell</title>");
  writeFileSync(join(webRoot, "app.js"), "console.log('bundle')");

  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: TEST_DATABASE_URL,
    RATE_LIMIT_ENABLED: "false",
    WEB_ROOT: webRoot,
  });
  const { db, sql } = createDatabase(TEST_DATABASE_URL, 2);
  app = await buildApp({ db, env });
  await app.ready();
  close = async () => {
    await app.close();
    await sql.end();
  };
});

afterAll(async () => {
  await close();
});

describe("serving the web client", () => {
  it("serves a built asset", async () => {
    const response = await app.inject({ method: "GET", url: "/app.js" });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("bundle");
  });

  it("serves the app shell for a client-side route", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/freunde/irgendeine-id",
      headers: { accept: "text/html" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("shell");
  });

  it("answers unknown API paths with JSON, never with the shell", async () => {
    // A mistyped endpoint returning HTML would turn a clear 404 into a
    // confusing parse error on the client.
    const response = await app.inject({
      method: "GET",
      url: "/api/gibtsnicht",
      headers: { accept: "text/html" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe("not_found");
  });

  it("keeps the API reachable", async () => {
    const response = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(response.statusCode).toBe(401);
  });

  it("still answers the health probe", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.json()).toEqual({ status: "ok" });
  });
});
