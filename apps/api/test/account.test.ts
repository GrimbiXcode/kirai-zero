import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { eq, or, sql as raw } from "drizzle-orm";
import { CONSENT_VERSION } from "shared";
import {
  friendRequests,
  friendships,
  items,
  preferences,
  sessions,
  users,
} from "../src/db/schema";
import { purgeDeletedAccounts } from "../src/lib/housekeeping";
import { sessionExpiry } from "../src/lib/sessions";
import {
  befriend,
  createTestApp,
  findItemId,
  registerUser,
  resetData,
  setPreference,
  type TestUser,
} from "./helpers";

let app: FastifyInstance;
let close: () => Promise<void>;
let anna: TestUser;
let ben: TestUser;

beforeAll(async () => {
  ({ app, close } = await createTestApp());
});
afterAll(async () => {
  await close();
});
beforeEach(async () => {
  await resetData(app);
  anna = await registerUser(app, { handle: "anna" });
  ben = await registerUser(app, { handle: "ben" });
});

describe("data export", () => {
  it("contains the account, its preferences and its connections", async () => {
    const koriander = await findItemId(app, anna, "Koriander");
    await setPreference(app, anna, koriander, {
      stance: "avoid",
      reason: "taste",
      note: "schmeckt nach Seife",
    });
    await app.inject({
      method: "POST",
      url: "/api/items",
      headers: anna.auth,
      payload: { name: "Grossmutters Guetzli", kind: "food" },
    });
    await befriend(app, anna, ben);

    const response = await app.inject({
      method: "GET",
      url: "/api/me/export",
      headers: anna.auth,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toContain(
      "kirai-zero-export.json",
    );

    const body = response.json();
    expect(body.account).toMatchObject({
      email: anna.email,
      handle: "anna",
      locale: "de",
    });
    expect(body.preferences).toHaveLength(1);
    expect(body.preferences[0].note).toBe("schmeckt nach Seife");
    expect(body.friends).toEqual([
      expect.objectContaining({ handle: "ben" }),
    ]);
    expect(
      body.itemsCreated.map((item: { name: string }) => item.name),
    ).toContain("Grossmutters Guetzli");
    // A friend appears by handle and display name only — never by email.
    expect(response.body).not.toContain(ben.email);
  });

  it("includes the consent record for special-category entries", async () => {
    const erdnuesse = await findItemId(app, anna, "Erdnüsse");
    await setPreference(app, anna, erdnuesse, {
      stance: "avoid",
      reason: "allergy",
      consentGiven: true,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/me/export",
      headers: anna.auth,
    });

    // Art. 15 covers the consent too: a person must be able to see what they
    // agreed to and when.
    const entry = response.json().preferences[0];
    expect(entry.reason).toBe("allergy");
    expect(entry.consentVersion).toBe(CONSENT_VERSION);
    expect(entry.consentedAt).toEqual(expect.any(String));
  });

  it("is limited to the requesting account", async () => {
    const koriander = await findItemId(app, anna, "Koriander");
    await setPreference(app, anna, koriander, { stance: "avoid" });

    const response = await app.inject({
      method: "GET",
      url: "/api/me/export",
      headers: ben.auth,
    });
    expect(response.json().preferences).toHaveLength(0);
  });

  it("requires a session", async () => {
    const response = await app.inject({ method: "GET", url: "/api/me/export" });
    expect(response.statusCode).toBe(401);
  });
});

describe("account deletion", () => {
  it("cuts off access and visibility the moment it is requested", async () => {
    const koriander = await findItemId(app, anna, "Koriander");
    await setPreference(app, anna, koriander, { stance: "avoid" });
    await befriend(app, anna, ben);

    await app.inject({ method: "DELETE", url: "/api/me", headers: anna.auth });

    // Ben must lose sight of Anna immediately, not when the purge job runs.
    const profile = await app.inject({
      method: "GET",
      url: `/api/friends/${anna.id}/profile`,
      headers: ben.auth,
    });
    expect(profile.statusCode).toBe(404);

    const friends = await app.inject({
      method: "GET",
      url: "/api/friends",
      headers: ben.auth,
    });
    expect(friends.json().friends).toHaveLength(0);

    const session = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: anna.auth,
    });
    expect(session.statusCode).toBe(401);
  });

  it("refuses a session that appears after the account was marked", async () => {
    await app.inject({ method: "DELETE", url: "/api/me", headers: anna.auth });

    // Belt and braces for the guard in resolveSession: even a session created
    // out of band must not authenticate a marked account.
    const token = "handmade-token-for-a-deleted-account";
    await app.db.insert(sessions).values({
      userId: anna.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: sessionExpiry(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it("erases the marked row and its data on the next housekeeping run", async () => {
    const koriander = await findItemId(app, anna, "Koriander");
    await setPreference(app, anna, koriander, { stance: "avoid" });
    await app.inject({ method: "DELETE", url: "/api/me", headers: anna.auth });

    const purged = await purgeDeletedAccounts(app.db);
    expect(purged).toBe(1);

    const [remainingUsers, remainingPreferences] = await Promise.all([
      app.db.select({ id: users.id }).from(users).where(eq(users.id, anna.id)),
      app.db
        .select({ id: preferences.id })
        .from(preferences)
        .where(eq(preferences.userId, anna.id)),
    ]);
    expect(remainingUsers).toHaveLength(0);
    expect(remainingPreferences).toHaveLength(0);

    // A second run finds nothing left to do.
    expect(await purgeDeletedAccounts(app.db)).toBe(0);
  });

  it("removes every trace of the account", async () => {
    const koriander = await findItemId(app, anna, "Koriander");
    await setPreference(app, anna, koriander, { stance: "avoid" });
    await befriend(app, anna, ben);

    const deleted = await app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: anna.auth,
    });
    expect(deleted.statusCode).toBe(200);
    await purgeDeletedAccounts(app.db);

    const [prefs, links, requests, openSessions] = await Promise.all([
      app.db
        .select({ id: preferences.id })
        .from(preferences)
        .where(eq(preferences.userId, anna.id)),
      app.db
        .select({ id: friendships.id })
        .from(friendships)
        .where(
          or(
            eq(friendships.userAId, anna.id),
            eq(friendships.userBId, anna.id),
          ),
        ),
      app.db
        .select({ id: friendRequests.id })
        .from(friendRequests)
        .where(
          or(
            eq(friendRequests.fromUserId, anna.id),
            eq(friendRequests.toUserId, anna.id),
          ),
        ),
      app.db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, anna.id)),
    ]);

    expect(prefs).toHaveLength(0);
    expect(links).toHaveLength(0);
    expect(requests).toHaveLength(0);
    expect(openSessions).toHaveLength(0);
  });

  it("ends the session and frees the handle", async () => {
    await app.inject({ method: "DELETE", url: "/api/me", headers: anna.auth });

    const afterDelete = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: anna.auth,
    });
    expect(afterDelete.statusCode).toBe(401);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: anna.email, password: "correct horse battery" },
    });
    expect(login.statusCode).toBe(401);

    // The handle becomes available again rather than being reserved forever.
    const reused = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        handle: "anna",
        email: "andere-anna@example.org",
        displayName: "Andere Anna",
        password: "ein sicheres passwort",
      },
    });
    expect(reused.statusCode).toBe(201);
  });

  it("keeps a catalogue item the deleted user contributed, without its author", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/items",
      headers: anna.auth,
      payload: { name: "Grossmutters Guetzli", kind: "food" },
    });
    const itemId = created.json().item.id;
    // Ben's list depends on that item, so deleting Anna must not delete it.
    await setPreference(app, ben, itemId, { stance: "love" });

    await app.inject({ method: "DELETE", url: "/api/me", headers: anna.auth });
    await purgeDeletedAccounts(app.db);

    const rows = await app.db
      .select()
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);
    expect(rows[0]).toBeDefined();
    expect(rows[0]!.createdBy).toBeNull();

    const bensList = await app.inject({
      method: "GET",
      url: "/api/me/preferences",
      headers: ben.auth,
    });
    expect(bensList.json().preferences).toHaveLength(1);
  });
});

describe("retention", () => {
  it("does not store an IP address or user agent with a session", async () => {
    const columns = await app.db.execute(
      raw`SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions'`,
    );
    const names = [...columns].map((row) => String(row.column_name));
    // A regression here would mean the app started collecting data the privacy
    // concept says it does not.
    expect(names).not.toContain("ip_address");
    expect(names).not.toContain("user_agent");
    expect(names).toContain("expires_at");
  });
});
