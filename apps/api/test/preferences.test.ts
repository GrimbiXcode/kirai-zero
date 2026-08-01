import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { CONSENT_VERSION } from "shared";
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
let user: TestUser;

beforeAll(async () => {
  ({ app, close } = await createTestApp());
});
afterAll(async () => {
  await close();
});
beforeEach(async () => {
  await resetData(app);
  user = await registerUser(app);
});

describe("item catalogue", () => {
  it("finds a seeded item by name", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/items?q=Koriander",
      headers: user.auth,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().items[0].name).toBe("Koriander");
  });

  it("finds an umlaut item typed without the umlaut", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/items?q=suesskartoffel",
      headers: user.auth,
    });
    const names = response.json().items.map((item: { name: string }) => item.name);
    expect(names).toContain("Süsskartoffeln");
  });

  it("reuses an existing item instead of creating a duplicate", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/items",
      headers: user.auth,
      payload: { name: "Sellerieknolle", kind: "ingredient" },
    });
    expect(first.statusCode).toBe(201);
    const firstId = first.json().item.id;

    // Different casing and spacing must resolve to the same catalogue entry,
    // otherwise aggregating across people silently misses matches.
    const second = await app.inject({
      method: "POST",
      url: "/api/items",
      headers: user.auth,
      payload: { name: "  SELLERIEKNOLLE ", kind: "ingredient" },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().item.id).toBe(firstId);
  });

  it("keeps the same name under different kinds apart", async () => {
    const food = await app.inject({
      method: "POST",
      url: "/api/items",
      headers: user.auth,
      payload: { name: "Kaffeebohnen", kind: "food" },
    });
    const gift = await app.inject({
      method: "POST",
      url: "/api/items",
      headers: user.auth,
      payload: { name: "Kaffeebohnen", kind: "gift" },
    });
    expect(gift.json().item.id).not.toBe(food.json().item.id);
  });

  it("refuses a name with no usable characters", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/items",
      headers: user.auth,
      payload: { name: "!!!", kind: "other" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("requires a session", async () => {
    const response = await app.inject({ method: "GET", url: "/api/items?q=a" });
    expect(response.statusCode).toBe(401);
  });
});

describe("preferences", () => {
  it("stores, updates and deletes an entry", async () => {
    const itemId = await findItemId(app, user, "Koriander");

    await setPreference(app, user, itemId, {
      stance: "avoid",
      reason: "taste",
      note: "schmeckt nach Seife",
    });

    const listed = await app.inject({
      method: "GET",
      url: "/api/me/preferences",
      headers: user.auth,
    });
    expect(listed.json().preferences).toHaveLength(1);
    expect(listed.json().preferences[0]).toMatchObject({
      stance: "avoid",
      reason: "taste",
      note: "schmeckt nach Seife",
      visibility: "friends",
    });

    // A second PUT for the same item updates in place rather than duplicating.
    await setPreference(app, user, itemId, { stance: "like", reason: "taste" });
    const updated = await app.inject({
      method: "GET",
      url: "/api/me/preferences",
      headers: user.auth,
    });
    expect(updated.json().preferences).toHaveLength(1);
    expect(updated.json().preferences[0].stance).toBe("like");
    expect(updated.json().preferences[0].note).toBeNull();

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/me/preferences/${itemId}`,
      headers: user.auth,
    });
    expect(deleted.statusCode).toBe(200);

    const empty = await app.inject({
      method: "GET",
      url: "/api/me/preferences",
      headers: user.auth,
    });
    expect(empty.json().preferences).toHaveLength(0);
  });

  it("rejects an unknown item and an invalid stance", async () => {
    const unknownItem = await app.inject({
      method: "PUT",
      url: "/api/me/preferences/00000000-0000-4000-8000-000000000000",
      headers: user.auth,
      payload: { stance: "like" },
    });
    expect(unknownItem.statusCode).toBe(404);

    const itemId = await findItemId(app, user, "Koriander");
    const badStance = await app.inject({
      method: "PUT",
      url: `/api/me/preferences/${itemId}`,
      headers: user.auth,
      payload: { stance: "hasst-es-abgrundtief" },
    });
    expect(badStance.statusCode).toBe(400);
  });

  it("stores an ordinary reason without asking for consent", async () => {
    const itemId = await findItemId(app, user, "Koriander");
    const response = await app.inject({
      method: "PUT",
      url: `/api/me/preferences/${itemId}`,
      headers: user.auth,
      payload: { stance: "avoid", reason: "taste" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().preference.consentedAt).toBeNull();
    expect(response.json().preference.consentVersion).toBeNull();
  });

  it("keeps one user's list out of another user's list", async () => {
    const other = await registerUser(app);
    const itemId = await findItemId(app, user, "Koriander");
    await setPreference(app, user, itemId, { stance: "avoid" });

    const response = await app.inject({
      method: "GET",
      url: "/api/me/preferences",
      headers: other.auth,
    });
    expect(response.json().preferences).toHaveLength(0);
  });
});

/**
 * Art. 9(1) GDPR bans processing special categories of data; the app relies on
 * the explicit consent of the person under Art. 9(2)(a). These tests guard the
 * gate, because a regression here would mean silently collecting health and
 * belief data without a legal basis.
 */
describe("special-category consent", () => {
  const SPECIAL_REASONS = [
    "allergy",
    "intolerance",
    "religious",
    "ethical",
  ] as const;

  it.each(SPECIAL_REASONS)("refuses reason %s without consent", async (reason) => {
    const itemId = await findItemId(app, user, "Erdnüsse");
    const response = await app.inject({
      method: "PUT",
      url: `/api/me/preferences/${itemId}`,
      headers: user.auth,
      payload: { stance: "avoid", reason },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("consent_required");
  });

  it("refuses it for a private entry too", async () => {
    const itemId = await findItemId(app, user, "Erdnüsse");
    const response = await app.inject({
      method: "PUT",
      url: `/api/me/preferences/${itemId}`,
      headers: user.auth,
      payload: { stance: "avoid", reason: "allergy", visibility: "private" },
    });

    // The prohibition attaches to the processing, not to the disclosure: an
    // allergy kept to oneself still needs a legal basis.
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("consent_required");
  });

  it("records when consent was given and to which wording", async () => {
    const itemId = await findItemId(app, user, "Erdnüsse");
    const before = Date.now();
    const response = await app.inject({
      method: "PUT",
      url: `/api/me/preferences/${itemId}`,
      headers: user.auth,
      payload: { stance: "avoid", reason: "allergy", consentGiven: true },
    });

    expect(response.statusCode).toBe(200);
    const preference = response.json().preference;
    expect(preference.consentVersion).toBe(CONSENT_VERSION);
    expect(new Date(preference.consentedAt).getTime()).toBeGreaterThanOrEqual(
      before - 1000,
    );
  });

  it("clears the record when the reason moves out of the special category", async () => {
    const itemId = await findItemId(app, user, "Erdnüsse");
    await setPreference(app, user, itemId, {
      stance: "avoid",
      reason: "allergy",
      consentGiven: true,
    });

    // Switching to an ordinary reason is how a person withdraws consent, and
    // it has to take the stored proof with it.
    const updated = await app.inject({
      method: "PUT",
      url: `/api/me/preferences/${itemId}`,
      headers: user.auth,
      payload: { stance: "avoid", reason: "taste" },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().preference.consentedAt).toBeNull();
    expect(updated.json().preference.consentVersion).toBeNull();
  });

  it("does not disclose the consent record to a friend", async () => {
    const friend = await registerUser(app);
    const itemId = await findItemId(app, user, "Erdnüsse");
    await setPreference(app, user, itemId, {
      stance: "avoid",
      reason: "allergy",
      consentGiven: true,
    });
    await befriend(app, user, friend);

    const profile = await app.inject({
      method: "GET",
      url: `/api/friends/${user.id}/profile`,
      headers: friend.auth,
    });

    expect(profile.statusCode).toBe(200);
    expect(profile.body).not.toContain("consentedAt");
    expect(profile.body).not.toContain(CONSENT_VERSION);
    // The entry itself is of course visible — that is the point of consenting.
    expect(profile.body).toContain("Erdnüsse");
  });
});
