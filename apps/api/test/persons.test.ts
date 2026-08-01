import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { persons } from "../src/db/schema";
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

async function createPerson(user: TestUser, displayName: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/persons",
    headers: user.auth,
    payload: { displayName },
  });
  if (response.statusCode !== 201) {
    throw new Error(`create person failed: ${response.body}`);
  }
  return response.json().person as { id: string };
}

async function addNote(
  user: TestUser,
  personId: string,
  itemId: string,
  stance: string,
) {
  const response = await app.inject({
    method: "PUT",
    url: `/api/persons/${personId}/entries/${itemId}`,
    headers: user.auth,
    payload: { stance },
  });
  if (response.statusCode !== 200) {
    throw new Error(`add note failed: ${response.body}`);
  }
  return response.json().person;
}

describe("person profiles", () => {
  it("creates, renames, lists and deletes a profile", async () => {
    const person = await createPerson(anna, "Oma Trudi");

    const renamed = await app.inject({
      method: "PATCH",
      url: `/api/persons/${person.id}`,
      headers: anna.auth,
      payload: { displayName: "Grossmutter Trudi", note: "mag es schlicht" },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().person).toMatchObject({
      displayName: "Grossmutter Trudi",
      note: "mag es schlicht",
      linkedUser: null,
    });

    const listed = await app.inject({
      method: "GET",
      url: "/api/persons",
      headers: anna.auth,
    });
    expect(listed.json().persons).toHaveLength(1);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/persons/${person.id}`,
      headers: anna.auth,
    });
    expect(deleted.statusCode).toBe(200);

    const empty = await app.inject({
      method: "GET",
      url: "/api/persons",
      headers: anna.auth,
    });
    expect(empty.json().persons).toHaveLength(0);
  });

  it("keeps a profile invisible to everyone but its owner", async () => {
    const person = await createPerson(anna, "Oma Trudi");
    const itemId = await findItemId(app, anna, "Koriander");
    await addNote(anna, person.id, itemId, "dislike");

    // 404 rather than 403 throughout: that a given profile exists is itself
    // something only the owner gets to know.
    for (const call of [
      { method: "GET" as const, url: `/api/persons/${person.id}` },
      { method: "DELETE" as const, url: `/api/persons/${person.id}` },
    ]) {
      const response = await app.inject({ ...call, headers: ben.auth });
      expect(response.statusCode).toBe(404);
    }

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/persons/${person.id}`,
      headers: ben.auth,
      payload: { displayName: "Entführt" },
    });
    expect(patched.statusCode).toBe(404);

    const written = await app.inject({
      method: "PUT",
      url: `/api/persons/${person.id}/entries/${itemId}`,
      headers: ben.auth,
      payload: { stance: "love" },
    });
    expect(written.statusCode).toBe(404);

    const bensList = await app.inject({
      method: "GET",
      url: "/api/persons",
      headers: ben.auth,
    });
    expect(bensList.json().persons).toHaveLength(0);
    expect(bensList.body).not.toContain("Oma Trudi");
  });

  it("stores and removes notes", async () => {
    const person = await createPerson(anna, "Oma Trudi");
    const itemId = await findItemId(app, anna, "Koriander");

    const added = await addNote(anna, person.id, itemId, "dislike");
    expect(added.entries).toHaveLength(1);
    expect(added.entries[0]).toMatchObject({ stance: "dislike", status: null });

    // A second write for the same item updates rather than duplicating.
    const updated = await addNote(anna, person.id, itemId, "love");
    expect(updated.entries).toHaveLength(1);
    expect(updated.entries[0].stance).toBe("love");

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/persons/${person.id}/entries/${itemId}`,
      headers: anna.auth,
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().person.entries).toHaveLength(0);
  });

  it("leaves an unlinked profile without any status", async () => {
    const person = await createPerson(anna, "Oma Trudi");
    const itemId = await findItemId(app, anna, "Koriander");
    const detail = await addNote(anna, person.id, itemId, "dislike");

    // Nothing to compare against, so claiming "unconfirmed" would be noise.
    expect(detail.entries[0].status).toBeNull();
  });
});

describe("linking a profile to an account", () => {
  it("refuses anyone who is not a confirmed friend", async () => {
    const person = await createPerson(anna, "Ben vielleicht");

    const stranger = await app.inject({
      method: "POST",
      url: `/api/persons/${person.id}/link`,
      headers: anna.auth,
      payload: { handle: "ben" },
    });
    expect(stranger.statusCode).toBe(404);

    const unknown = await app.inject({
      method: "POST",
      url: `/api/persons/${person.id}/link`,
      headers: anna.auth,
      payload: { handle: "niemand" },
    });
    expect(unknown.statusCode).toBe(404);
  });

  it("links a friend and refuses a second profile for the same one", async () => {
    await befriend(app, anna, ben);
    const person = await createPerson(anna, "Ben");

    const linked = await app.inject({
      method: "POST",
      url: `/api/persons/${person.id}/link`,
      headers: anna.auth,
      payload: { handle: "ben" },
    });
    expect(linked.statusCode).toBe(200);
    expect(linked.json().person.linkedUser).toMatchObject({ handle: "ben" });

    const second = await createPerson(anna, "Ben nochmals");
    const duplicate = await app.inject({
      method: "POST",
      url: `/api/persons/${second.id}/link`,
      headers: anna.auth,
      payload: { handle: "ben" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error).toBe("friend_already_linked");

    const again = await app.inject({
      method: "POST",
      url: `/api/persons/${person.id}/link`,
      headers: anna.auth,
      payload: { handle: "ben" },
    });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe("already_linked");
  });

  it("reuses one profile per friend via for-friend", async () => {
    await befriend(app, anna, ben);

    const first = await app.inject({
      method: "POST",
      url: `/api/persons/for-friend/${ben.id}`,
      headers: anna.auth,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: `/api/persons/for-friend/${ben.id}`,
      headers: anna.auth,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().person.id).toBe(first.json().person.id);

    const outsider = await registerUser(app, { handle: "carla" });
    const refused = await app.inject({
      method: "POST",
      url: `/api/persons/for-friend/${outsider.id}`,
      headers: anna.auth,
    });
    expect(refused.statusCode).toBe(404);
  });
});

describe("comparing notes with what the person says", () => {
  async function linkedProfileWithNotes() {
    await befriend(app, anna, ben);
    const person = await createPerson(anna, "Ben");
    await app.inject({
      method: "POST",
      url: `/api/persons/${person.id}/link`,
      headers: anna.auth,
      payload: { handle: "ben" },
    });
    return person;
  }

  it("marks agreement, disagreement and silence apart", async () => {
    const person = await linkedProfileWithNotes();
    const koriander = await findItemId(app, anna, "Koriander");
    const buecher = await findItemId(app, anna, "Bücher");
    const wandern = await findItemId(app, anna, "Wandern");

    // Ben says what he thinks; Anna guessed one right, one wrong, one blind.
    await setPreference(app, ben, koriander, { stance: "dislike" });
    await setPreference(app, ben, buecher, { stance: "dislike" });

    await addNote(anna, person.id, koriander, "dislike");
    await addNote(anna, person.id, buecher, "love");
    const detail = await addNote(anna, person.id, wandern, "like");

    const byName = new Map(
      detail.entries.map((entry: { item: { name: string }; status: string }) => [
        entry.item.name,
        entry.status,
      ]),
    );
    expect(byName.get("Koriander")).toBe("confirmed");
    expect(byName.get("Bücher")).toBe("contradicted");
    expect(byName.get("Wandern")).toBe("unconfirmed");
  });

  it("treats a stronger wording as agreement, not as a contradiction", async () => {
    const person = await linkedProfileWithNotes();
    const buecher = await findItemId(app, anna, "Bücher");
    await setPreference(app, ben, buecher, { stance: "like" });

    const detail = await addNote(anna, person.id, buecher, "love");
    expect(detail.entries[0].status).toBe("confirmed");
  });

  it("never turns a private entry into a confirmation", async () => {
    const person = await linkedProfileWithNotes();
    const lakritz = await findItemId(app, anna, "Lakritz");
    await setPreference(app, ben, lakritz, {
      stance: "dislike",
      visibility: "private",
    });

    const detail = await addNote(anna, person.id, lakritz, "dislike");
    // Linking must not reveal anything the friend's profile would not: a
    // private entry has to be indistinguishable from no entry at all.
    expect(detail.entries[0].status).toBe("unconfirmed");
  });
});

describe("notes on a friend's profile", () => {
  it("are returned separately from what the friend said", async () => {
    await befriend(app, anna, ben);
    const koriander = await findItemId(app, anna, "Koriander");
    const buecher = await findItemId(app, anna, "Bücher");
    await setPreference(app, ben, koriander, { stance: "dislike" });

    const container = await app.inject({
      method: "POST",
      url: `/api/persons/for-friend/${ben.id}`,
      headers: anna.auth,
    });
    const personId = container.json().person.id;
    await addNote(anna, personId, buecher, "love");

    const profile = await app.inject({
      method: "GET",
      url: `/api/friends/${ben.id}/profile`,
      headers: anna.auth,
    });
    const body = profile.json();

    expect(body.personId).toBe(personId);
    expect(body.dislikes.map((e: { item: { name: string } }) => e.item.name)).toEqual([
      "Koriander",
    ]);
    // The guess stays out of the friend's own lists — it is not a fact.
    expect(body.likes).toHaveLength(0);
    expect(body.myNotes).toHaveLength(1);
    expect(body.myNotes[0]).toMatchObject({
      stance: "love",
      status: "unconfirmed",
    });
  });

  it("are absent and unwritable without a friendship", async () => {
    const profile = await app.inject({
      method: "GET",
      url: `/api/friends/${ben.id}/profile`,
      headers: anna.auth,
    });
    expect(profile.statusCode).toBe(404);
  });

  it("stay with the owner when the friendship ends, but lose the link", async () => {
    await befriend(app, anna, ben);
    const container = await app.inject({
      method: "POST",
      url: `/api/persons/for-friend/${ben.id}`,
      headers: anna.auth,
    });
    const personId = container.json().person.id;
    const koriander = await findItemId(app, anna, "Koriander");
    await addNote(anna, personId, koriander, "dislike");

    await app.inject({
      method: "DELETE",
      url: `/api/friends/${ben.id}`,
      headers: anna.auth,
    });

    const detail = await app.inject({
      method: "GET",
      url: `/api/persons/${personId}`,
      headers: anna.auth,
    });
    expect(detail.statusCode).toBe(200);
    // The notes are Anna's own and survive; what goes is the association with
    // an identified account she is no longer connected to.
    expect(detail.json().person.linkedUser).toBeNull();
    expect(detail.json().person.entries).toHaveLength(1);
  });

  it("lose the link when the linked account is deleted", async () => {
    await befriend(app, anna, ben);
    const container = await app.inject({
      method: "POST",
      url: `/api/persons/for-friend/${ben.id}`,
      headers: anna.auth,
    });
    const personId = container.json().person.id;

    await app.inject({ method: "DELETE", url: "/api/me", headers: ben.auth });

    const rows = await app.db
      .select({ linkedUserId: persons.linkedUserId })
      .from(persons)
      .where(eq(persons.id, personId));
    expect(rows[0]?.linkedUserId).toBeNull();
  });
});
