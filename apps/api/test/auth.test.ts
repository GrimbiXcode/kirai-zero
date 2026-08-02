import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, registerUser, resetData } from "./helpers";

let app: FastifyInstance;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ app, close } = await createTestApp());
});
afterAll(async () => {
  await close();
});
beforeEach(async () => {
  await resetData(app);
});

describe("registration", () => {
  it("creates an account and starts a session", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        handle: "Anna",
        email: "Anna@Example.ORG",
        displayName: "Anna",
        password: "ein sicheres passwort",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    // Handle and email are normalised so lookups are case-insensitive.
    expect(body.user.handle).toBe("anna");
    expect(body.user.email).toBe("anna@example.org");
    expect(body.token).toBeTypeOf("string");
    expect(response.cookies.some((c) => c.name === "kirai_session")).toBe(true);
  });

  it("never returns the password hash", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        handle: "bea",
        email: "bea@example.org",
        displayName: "Bea",
        password: "ein sicheres passwort",
      },
    });
    expect(response.body).not.toContain("argon2");
    expect(response.json().user.passwordHash).toBeUndefined();
  });

  it("rejects a duplicate email without revealing which field collided", async () => {
    await registerUser(app, { handle: "carla", email: "carla@example.org" });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        handle: "carla2",
        email: "carla@example.org",
        displayName: "Carla",
        password: "ein sicheres passwort",
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("account_exists");
  });

  it("rejects a weak password and an unusable handle", async () => {
    const weak = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        handle: "dora",
        email: "dora@example.org",
        displayName: "Dora",
        password: "kurz",
      },
    });
    expect(weak.statusCode).toBe(400);

    const badHandle = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        handle: "not a handle!",
        email: "dora@example.org",
        displayName: "Dora",
        password: "ein sicheres passwort",
      },
    });
    expect(badHandle.statusCode).toBe(400);
  });
});

describe("login", () => {
  it("accepts the right password and rejects the wrong one identically to an unknown account", async () => {
    const user = await registerUser(app, { password: "ein sicheres passwort" });

    const ok = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: user.email, password: "ein sicheres passwort" },
    });
    expect(ok.statusCode).toBe(200);

    const wrongPassword = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: user.email, password: "falsches passwort" },
    });
    const unknownAccount = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "niemand@example.org", password: "falsches passwort" },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownAccount.statusCode).toBe(401);
    // Same body for both: the endpoint must not tell an attacker which
    // addresses are registered.
    expect(wrongPassword.json()).toEqual(unknownAccount.json());
  });
});

describe("brute-force protection", () => {
  it("stops repeated login attempts against one account", async () => {
    const limited = await createTestApp({ rateLimit: true });
    try {
      await resetData(limited.app);
      const user = await registerUser(limited.app, {
        password: "ein sicheres passwort",
      });

      const attempt = () =>
        limited.app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: user.email, password: "raten raten raten" },
        });

      // The route allows 20 attempts per quarter hour; the next one is refused
      // before the password is even checked.
      for (let i = 0; i < 20; i += 1) {
        expect((await attempt()).statusCode).toBe(401);
      }
      expect((await attempt()).statusCode).toBe(429);
    } finally {
      await limited.close();
    }
  });
});

describe("session handling", () => {
  it("requires authentication for protected routes", async () => {
    const response = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(response.statusCode).toBe(401);
  });

  it("rejects a token that is not a real session", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: "Bearer not-a-real-token" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("invalidates the session on logout", async () => {
    const user = await registerUser(app);

    const before = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: user.auth,
    });
    expect(before.statusCode).toBe(200);

    await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: user.auth,
    });

    const after = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: user.auth,
    });
    expect(after.statusCode).toBe(401);
  });

  it("blocks a cookie-authenticated write from an unlisted origin", async () => {
    const user = await registerUser(app);

    const foreign = await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: {
        cookie: `kirai_session=${user.token}`,
        origin: "https://angreifer.example",
      },
      payload: { handle: "irgendwer" },
    });
    expect(foreign.statusCode).toBe(403);
    expect(foreign.json().error).toBe("bad_origin");

    // The same request from the app's own origin passes the origin check and
    // fails later, on the missing user.
    const allowed = await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: {
        cookie: `kirai_session=${user.token}`,
        origin: "http://localhost:5173",
      },
      payload: { handle: "irgendwer" },
    });
    expect(allowed.statusCode).toBe(404);
  });

  it("accepts a write from the origin it was addressed on", async () => {
    const user = await registerUser(app);

    // The container image serves the web client from this very server, so the
    // app's origin is whatever host it was reached under — not something an
    // operator should have to list in CORS_ORIGINS.
    const response = await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: {
        cookie: `kirai_session=${user.token}`,
        host: "kirai.example.org",
        origin: "http://kirai.example.org",
      },
      payload: { handle: "irgendwer" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe("user_not_found");
  });

  it("still rejects a foreign origin that merely resembles the host", async () => {
    const user = await registerUser(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: {
        cookie: `kirai_session=${user.token}`,
        host: "kirai.example.org",
        origin: "http://kirai.example.org.angreifer.test",
      },
      payload: { handle: "irgendwer" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe("bad_origin");
  });
});
