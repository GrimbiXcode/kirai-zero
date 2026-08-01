import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
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
      stance: "dislike",
      note: "schmeckt nach Seife",
    });

    const listed = await app.inject({
      method: "GET",
      url: "/api/me/preferences",
      headers: user.auth,
    });
    expect(listed.json().preferences).toHaveLength(1);
    expect(listed.json().preferences[0]).toMatchObject({
      stance: "dislike",
      note: "schmeckt nach Seife",
      visibility: "friends",
    });

    // A second PUT for the same item updates in place rather than duplicating.
    await setPreference(app, user, itemId, { stance: "like" });
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

  it("rejects a stance that no longer exists", async () => {
    const itemId = await findItemId(app, user, "Koriander");
    const response = await app.inject({
      method: "PUT",
      url: `/api/me/preferences/${itemId}`,
      headers: user.auth,
      // "avoid" was folded into "dislike" when reasons were dropped: without a
      // reason to carry severity the two said the same thing.
      payload: { stance: "avoid" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("keeps one user's list out of another user's list", async () => {
    const other = await registerUser(app);
    const itemId = await findItemId(app, user, "Koriander");
    await setPreference(app, user, itemId, { stance: "dislike" });

    const response = await app.inject({
      method: "GET",
      url: "/api/me/preferences",
      headers: other.auth,
    });
    expect(response.json().preferences).toHaveLength(0);
  });
});
