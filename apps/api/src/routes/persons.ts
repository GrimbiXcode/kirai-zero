import type { FastifyInstance } from "fastify";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import {
  personCreateSchema,
  personEntryUpsertSchema,
  personLinkSchema,
  personUpdateSchema,
  itemIdParamSchema,
  userIdParamSchema,
  uuidParamSchema,
  type PersonDto,
} from "shared";
import { items, personEntries, persons, users } from "../db/schema";
import { authenticate, currentUser } from "../lib/auth";
import { toPublicUser } from "../lib/dto";
import { conflict, notFound } from "../lib/errors";
import { requireFriendship } from "../lib/friendship";
import { loadPersonEntries, requirePerson } from "../lib/persons";
import { parse } from "../lib/validate";

const publicUserColumns = {
  id: users.id,
  handle: users.handle,
  displayName: users.displayName,
};

export async function personRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/", async (request) => {
    const viewer = currentUser(request);

    const rows = await app.db
      .select({
        id: persons.id,
        displayName: persons.displayName,
        note: persons.note,
        linkedUserId: persons.linkedUserId,
        createdAt: persons.createdAt,
      })
      .from(persons)
      .where(eq(persons.ownerId, viewer.id))
      .orderBy(asc(persons.displayName));

    if (rows.length === 0) return { persons: [] };

    const [counts, linkedUsers] = await Promise.all([
      app.db
        .select({ personId: personEntries.personId, total: count() })
        .from(personEntries)
        .where(
          inArray(
            personEntries.personId,
            rows.map((row) => row.id),
          ),
        )
        .groupBy(personEntries.personId),
      loadLinkedUsers(app, rows),
    ]);
    const countByPerson = new Map(counts.map((row) => [row.personId, row.total]));

    const result: PersonDto[] = rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      note: row.note,
      linkedUser: row.linkedUserId
        ? (linkedUsers.get(row.linkedUserId) ?? null)
        : null,
      entryCount: countByPerson.get(row.id) ?? 0,
      createdAt: row.createdAt.toISOString(),
    }));
    return { persons: result };
  });

  app.post("/", async (request, reply) => {
    const viewer = currentUser(request);
    const input = parse(personCreateSchema, request.body);

    const inserted = await app.db
      .insert(persons)
      .values({
        ownerId: viewer.id,
        displayName: input.displayName,
        note: input.note ?? null,
      })
      .returning();

    return reply.code(201).send({ person: await detail(app, inserted[0]!) });
  });

  /**
   * Returns the profile holding the viewer's notes about a friend, creating it
   * on first use. A separate endpoint rather than a second write path, so the
   * entry upsert below stays the only place that writes notes.
   */
  app.post("/for-friend/:userId", async (request, reply) => {
    const viewer = currentUser(request);
    const { userId } = parse(userIdParamSchema, request.params);
    await requireFriendship(app.db, viewer.id, userId);

    const existing = await app.db
      .select()
      .from(persons)
      .where(
        and(eq(persons.ownerId, viewer.id), eq(persons.linkedUserId, userId)),
      )
      .limit(1);

    const found = existing[0];
    if (found) return { person: await detail(app, found) };

    const friendRows = await app.db
      .select(publicUserColumns)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const friend = friendRows[0];
    if (!friend) throw notFound("user_not_found", "No such user");

    const inserted = await app.db
      .insert(persons)
      .values({
        ownerId: viewer.id,
        displayName: friend.displayName,
        linkedUserId: userId,
      })
      .returning();

    return reply.code(201).send({ person: await detail(app, inserted[0]!) });
  });

  app.get("/:id", async (request) => {
    const viewer = currentUser(request);
    const { id } = parse(uuidParamSchema, request.params);
    const person = await requirePerson(app.db, viewer.id, id);
    return { person: await detail(app, person) };
  });

  app.patch("/:id", async (request) => {
    const viewer = currentUser(request);
    const { id } = parse(uuidParamSchema, request.params);
    const input = parse(personUpdateSchema, request.body);
    await requirePerson(app.db, viewer.id, id);

    const updated = await app.db
      .update(persons)
      .set({
        ...(input.displayName === undefined
          ? {}
          : { displayName: input.displayName }),
        ...(input.note === undefined ? {} : { note: input.note }),
        updatedAt: new Date(),
      })
      .where(eq(persons.id, id))
      .returning();

    return { person: await detail(app, updated[0]!) };
  });

  app.delete("/:id", async (request) => {
    const viewer = currentUser(request);
    const { id } = parse(uuidParamSchema, request.params);
    await requirePerson(app.db, viewer.id, id);
    await app.db.delete(persons).where(eq(persons.id, id));
    return { ok: true };
  });

  app.put("/:id/entries/:itemId", async (request) => {
    const viewer = currentUser(request);
    const { id } = parse(uuidParamSchema, request.params);
    const { itemId } = parse(itemIdParamSchema, request.params);
    const input = parse(personEntryUpsertSchema, request.body);
    const person = await requirePerson(app.db, viewer.id, id);

    const itemRows = await app.db
      .select({ id: items.id })
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);
    if (!itemRows[0]) throw notFound("item_not_found", "No such item");

    const now = new Date();
    const values = {
      stance: input.stance,
      note: input.note ?? null,
      updatedAt: now,
    };
    await app.db
      .insert(personEntries)
      .values({ personId: person.id, itemId, ...values })
      .onConflictDoUpdate({
        target: [personEntries.personId, personEntries.itemId],
        set: values,
      });

    return { person: await detail(app, person) };
  });

  app.delete("/:id/entries/:itemId", async (request) => {
    const viewer = currentUser(request);
    const { id } = parse(uuidParamSchema, request.params);
    const { itemId } = parse(itemIdParamSchema, request.params);
    const person = await requirePerson(app.db, viewer.id, id);

    const deleted = await app.db
      .delete(personEntries)
      .where(
        and(
          eq(personEntries.personId, person.id),
          eq(personEntries.itemId, itemId),
        ),
      )
      .returning({ id: personEntries.id });
    if (deleted.length === 0) {
      throw notFound("entry_not_found", "No note for this item");
    }
    return { person: await detail(app, person) };
  });

  /**
   * Ties an existing profile to an account. Only a confirmed friend can be
   * chosen: without a relationship the link would be a claim about someone the
   * owner is not connected to, and it would not produce any comparison anyway.
   */
  app.post("/:id/link", async (request) => {
    const viewer = currentUser(request);
    const { id } = parse(uuidParamSchema, request.params);
    const { handle } = parse(personLinkSchema, request.body);
    const person = await requirePerson(app.db, viewer.id, id);

    if (person.linkedUserId) {
      throw conflict("already_linked", "This person is already linked");
    }

    const targetRows = await app.db
      .select(publicUserColumns)
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1);
    const target = targetRows[0];
    // 404 for a stranger as well as for an unknown handle: whether an account
    // exists is not something an outsider gets to learn.
    if (!target) throw notFound("user_not_found", "No user with this handle");
    await requireFriendship(app.db, viewer.id, target.id);

    const taken = await app.db
      .select({ id: persons.id })
      .from(persons)
      .where(
        and(
          eq(persons.ownerId, viewer.id),
          eq(persons.linkedUserId, target.id),
        ),
      )
      .limit(1);
    if (taken[0]) {
      throw conflict("friend_already_linked", "Another person is linked here");
    }

    const updated = await app.db
      .update(persons)
      .set({ linkedUserId: target.id, updatedAt: new Date() })
      .where(eq(persons.id, person.id))
      .returning();

    return { person: await detail(app, updated[0]!) };
  });

  app.post("/:id/unlink", async (request) => {
    const viewer = currentUser(request);
    const { id } = parse(uuidParamSchema, request.params);
    await requirePerson(app.db, viewer.id, id);

    const updated = await app.db
      .update(persons)
      .set({ linkedUserId: null, updatedAt: new Date() })
      .where(eq(persons.id, id))
      .returning();

    return { person: await detail(app, updated[0]!) };
  });
}

async function loadLinkedUsers(
  app: FastifyInstance,
  rows: { linkedUserId: string | null }[],
) {
  const ids = rows.flatMap((row) => (row.linkedUserId ? [row.linkedUserId] : []));
  if (ids.length === 0) return new Map<string, ReturnType<typeof toPublicUser>>();
  const people = await app.db
    .select(publicUserColumns)
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(people.map((user) => [user.id, toPublicUser(user)]));
}

async function detail(
  app: FastifyInstance,
  person: {
    id: string;
    ownerId: string;
    displayName: string;
    note: string | null;
    linkedUserId: string | null;
    createdAt: Date;
  },
) {
  const [entries, linked] = await Promise.all([
    loadPersonEntries(app.db, person),
    person.linkedUserId
      ? app.db
          .select(publicUserColumns)
          .from(users)
          .where(eq(users.id, person.linkedUserId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    id: person.id,
    displayName: person.displayName,
    note: person.note,
    linkedUser: linked[0] ? toPublicUser(linked[0]) : null,
    entryCount: entries.length,
    createdAt: person.createdAt.toISOString(),
    entries,
  };
}
