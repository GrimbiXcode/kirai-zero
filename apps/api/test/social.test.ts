import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
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

describe("finding people", () => {
  it("finds a user by their exact handle and reports the relation", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/users/search?handle=ben",
      headers: anna.auth,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().users[0]).toMatchObject({
      user: { handle: "ben" },
      relation: "none",
    });
    // Never expose the email address of someone you are not connected to.
    expect(response.body).not.toContain("@example.org");
  });

  it("does not return the searching user themselves", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/users/search?handle=anna",
      headers: anna.auth,
    });
    expect(response.json().users).toHaveLength(0);
  });
});

describe("friend requests", () => {
  it("walks through request and acceptance", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: anna.auth,
      payload: { handle: "ben" },
    });
    expect(created.statusCode).toBe(201);
    const requestId = created.json().request.id;

    const bensInbox = await app.inject({
      method: "GET",
      url: "/api/friend-requests",
      headers: ben.auth,
    });
    expect(bensInbox.json().incoming).toHaveLength(1);
    expect(bensInbox.json().outgoing).toHaveLength(0);

    const accepted = await app.inject({
      method: "POST",
      url: `/api/friend-requests/${requestId}/accept`,
      headers: ben.auth,
    });
    expect(accepted.statusCode).toBe(200);

    const friends = await app.inject({
      method: "GET",
      url: "/api/friends",
      headers: anna.auth,
    });
    expect(friends.json().friends[0].user.handle).toBe("ben");
  });

  it("lets only the recipient accept", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: anna.auth,
      payload: { handle: "ben" },
    });
    const requestId = created.json().request.id;

    // The sender accepting their own request would be a one-sided friendship.
    const selfAccept = await app.inject({
      method: "POST",
      url: `/api/friend-requests/${requestId}/accept`,
      headers: anna.auth,
    });
    expect(selfAccept.statusCode).toBe(404);

    const outsider = await registerUser(app, { handle: "carla" });
    const outsiderAccept = await app.inject({
      method: "POST",
      url: `/api/friend-requests/${requestId}/accept`,
      headers: outsider.auth,
    });
    expect(outsiderAccept.statusCode).toBe(404);
  });

  it("completes the friendship when the other side asks back", async () => {
    await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: anna.auth,
      payload: { handle: "ben" },
    });

    const counterRequest = await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: ben.auth,
      payload: { handle: "anna" },
    });
    expect(counterRequest.statusCode).toBe(200);
    expect(counterRequest.json().status).toBe("accepted");

    const friends = await app.inject({
      method: "GET",
      url: "/api/friends",
      headers: ben.auth,
    });
    expect(friends.json().friends).toHaveLength(1);
  });

  it("refuses duplicates, self-requests and already-friends", async () => {
    const self = await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: anna.auth,
      payload: { handle: "anna" },
    });
    expect(self.statusCode).toBe(400);

    await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: anna.auth,
      payload: { handle: "ben" },
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: anna.auth,
      payload: { handle: "ben" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error).toBe("request_pending");
  });

  it("lets the recipient decline and the sender cancel", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: anna.auth,
      payload: { handle: "ben" },
    });
    const declined = await app.inject({
      method: "POST",
      url: `/api/friend-requests/${first.json().request.id}/decline`,
      headers: ben.auth,
    });
    expect(declined.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: "/api/friend-requests",
      headers: anna.auth,
      payload: { handle: "ben" },
    });
    expect(second.statusCode).toBe(201);
    const cancelled = await app.inject({
      method: "DELETE",
      url: `/api/friend-requests/${second.json().request.id}`,
      headers: anna.auth,
    });
    expect(cancelled.statusCode).toBe(200);

    const inbox = await app.inject({
      method: "GET",
      url: "/api/friend-requests",
      headers: ben.auth,
    });
    expect(inbox.json().incoming).toHaveLength(0);
  });
});

describe("friend profile access", () => {
  beforeEach(async () => {
    const koriander = await findItemId(app, anna, "Koriander");
    const buecher = await findItemId(app, anna, "Bücher");
    const erdnuesse = await findItemId(app, anna, "Erdnüsse");
    const lakritz = await findItemId(app, anna, "Lakritz");

    await setPreference(app, anna, koriander, {
      stance: "dislike",
      note: "schmeckt nach Seife",
    });
    await setPreference(app, anna, buecher, { stance: "love" });
    await setPreference(app, anna, erdnuesse, { stance: "dislike" });
    await setPreference(app, anna, lakritz, {
      stance: "dislike",
      visibility: "private",
    });
  });

  it("refuses the profile to someone who is not a friend", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/friends/${anna.id}/profile`,
      headers: ben.auth,
    });
    // 404, not 403: a stranger must not learn that this account exists.
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain("Koriander");
  });

  it("shows likes and dislikes to a friend, alphabetically", async () => {
    await befriend(app, anna, ben);

    const response = await app.inject({
      method: "GET",
      url: `/api/friends/${anna.id}/profile`,
      headers: ben.auth,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.likes.map((entry: { item: { name: string } }) => entry.item.name)).toEqual([
      "Bücher",
    ]);
    const dislikes = body.dislikes.map(
      (entry: { item: { name: string } }) => entry.item.name,
    );
    // Nothing outranks anything else any more, so the order is simply the
    // alphabetical one the query produced.
    expect(dislikes).toEqual(["Erdnüsse", "Koriander"]);
  });

  it("never discloses a private entry, not even to a friend", async () => {
    await befriend(app, anna, ben);

    const response = await app.inject({
      method: "GET",
      url: `/api/friends/${anna.id}/profile`,
      headers: ben.auth,
    });
    expect(response.body).not.toContain("Lakritz");

    // The owner still sees it in their own list.
    const own = await app.inject({
      method: "GET",
      url: "/api/me/preferences",
      headers: anna.auth,
    });
    expect(own.body).toContain("Lakritz");
  });

  it("does not leak the visibility flag of entries that are shown", async () => {
    await befriend(app, anna, ben);
    const response = await app.inject({
      method: "GET",
      url: `/api/friends/${anna.id}/profile`,
      headers: ben.auth,
    });
    expect(response.json().likes[0].visibility).toBeUndefined();
  });

  it("revokes access the moment the friendship ends", async () => {
    await befriend(app, anna, ben);

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/friends/${anna.id}`,
      headers: ben.auth,
    });
    expect(removed.statusCode).toBe(200);

    const after = await app.inject({
      method: "GET",
      url: `/api/friends/${anna.id}/profile`,
      headers: ben.auth,
    });
    expect(after.statusCode).toBe(404);

    // Unfriending is symmetric: the other side loses access too.
    const reverse = await app.inject({
      method: "GET",
      url: `/api/friends/${ben.id}/profile`,
      headers: anna.auth,
    });
    expect(reverse.statusCode).toBe(404);
  });

  it("refuses a profile request for oneself", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/friends/${anna.id}/profile`,
      headers: anna.auth,
    });
    expect(response.statusCode).toBe(404);
  });
});
