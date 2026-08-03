import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { asc, eq, inArray, or } from "drizzle-orm";
import {
  emailTokens,
  friendRequests,
  friendships,
  items,
  persons,
  preferences,
  sessions,
  users,
} from "../db/schema";
import { authenticate, currentUser } from "../lib/auth";
import { toItemDto, toPreferenceDto } from "../lib/dto";
import { loadPersonEntries } from "../lib/persons";
import { selectPreferenceColumns } from "../lib/queries";
import { SESSION_COOKIE } from "../lib/sessions";

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  /**
   * Art. 15/20 GDPR: everything stored about the requester, in a form they can
   * read and take elsewhere. Other people's data is reduced to the handle and
   * display name they already see in the app.
   */
  app.get("/export", async (request, reply) => {
    const viewer = currentUser(request);

    const [prefRows, friendshipRows, requestRows, createdItems] =
      await Promise.all([
        app.db
          .select(selectPreferenceColumns)
          .from(preferences)
          .innerJoin(items, eq(items.id, preferences.itemId))
          .where(eq(preferences.userId, viewer.id))
          .orderBy(asc(items.name)),
        app.db
          .select({
            userAId: friendships.userAId,
            userBId: friendships.userBId,
            createdAt: friendships.createdAt,
          })
          .from(friendships)
          .where(
            or(
              eq(friendships.userAId, viewer.id),
              eq(friendships.userBId, viewer.id),
            ),
          ),
        app.db
          .select({
            id: friendRequests.id,
            fromUserId: friendRequests.fromUserId,
            toUserId: friendRequests.toUserId,
            status: friendRequests.status,
            createdAt: friendRequests.createdAt,
            respondedAt: friendRequests.respondedAt,
          })
          .from(friendRequests)
          .where(
            or(
              eq(friendRequests.fromUserId, viewer.id),
              eq(friendRequests.toUserId, viewer.id),
            ),
          ),
        app.db
          .select()
          .from(items)
          .where(eq(items.createdBy, viewer.id))
          .orderBy(asc(items.name)),
      ]);

    const counterpartIds = new Set<string>();
    for (const row of friendshipRows) {
      counterpartIds.add(row.userAId === viewer.id ? row.userBId : row.userAId);
    }
    for (const row of requestRows) {
      counterpartIds.add(
        row.fromUserId === viewer.id ? row.toUserId : row.fromUserId,
      );
    }
    const counterparts =
      counterpartIds.size > 0
        ? await app.db
            .select({
              id: users.id,
              handle: users.handle,
              displayName: users.displayName,
            })
            .from(users)
            .where(inArray(users.id, [...counterpartIds]))
        : [];
    const byId = new Map(counterparts.map((user) => [user.id, user]));
    const describe = (id: string) => {
      const user = byId.get(id);
      return user
        ? { handle: user.handle, displayName: user.displayName }
        : { handle: null, displayName: null };
    };

    // Person profiles are the requester's own notes, so they belong in their
    // export — with the linked account named only by handle, as everywhere.
    const personRows = await app.db
      .select()
      .from(persons)
      .where(eq(persons.ownerId, viewer.id))
      .orderBy(asc(persons.displayName));
    const linkedIds = personRows.flatMap((row) =>
      row.linkedUserId ? [row.linkedUserId] : [],
    );
    const linkedHandles =
      linkedIds.length > 0
        ? await app.db
            .select({ id: users.id, handle: users.handle })
            .from(users)
            .where(inArray(users.id, linkedIds))
        : [];
    const handleById = new Map(linkedHandles.map((row) => [row.id, row.handle]));
    const exportedPersons = await Promise.all(
      personRows.map(async (row) => ({
        displayName: row.displayName,
        note: row.note,
        linkedTo: row.linkedUserId
          ? (handleById.get(row.linkedUserId) ?? null)
          : null,
        createdAt: row.createdAt.toISOString(),
        entries: await loadPersonEntries(app.db, row),
      })),
    );

    reply.header(
      "content-disposition",
      'attachment; filename="kirai-zero-export.json"',
    );
    return {
      exportedAt: new Date().toISOString(),
      account: {
        email: viewer.email,
        handle: viewer.handle,
        displayName: viewer.displayName,
        locale: viewer.locale,
        emailVerified: viewer.emailVerifiedAt !== null,
        createdAt: viewer.createdAt.toISOString(),
      },
      preferences: prefRows.map((row) =>
        toPreferenceDto({ ...row, item: toItemDto(row.item) }),
      ),
      friends: friendshipRows.map((row) => ({
        ...describe(row.userAId === viewer.id ? row.userBId : row.userAId),
        friendsSince: row.createdAt.toISOString(),
      })),
      friendRequests: requestRows.map((row) => ({
        direction: row.fromUserId === viewer.id ? "outgoing" : "incoming",
        ...describe(
          row.fromUserId === viewer.id ? row.toUserId : row.fromUserId,
        ),
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        respondedAt: row.respondedAt?.toISOString() ?? null,
      })),
      itemsCreated: createdItems.map(toItemDto),
      persons: exportedPersons,
    };
  });

  /**
   * Art. 17 GDPR. The row is marked and erased by the next housekeeping run
   * (see lib/housekeeping.ts), well inside the 24 hours the privacy concept
   * promises. Nothing survives that window in a usable form:
   *
   * - the identifying fields are overwritten right here, which also frees the
   *   handle and the email address for reuse and makes signing in impossible
   * - sessions, friendships and friend requests are deleted outright, so
   *   visibility to other people ends in the same transaction
   * - pending email tokens go with them: a password reset link still sitting
   *   in an inbox must not outlive the account it was issued for
   *
   * What is left — the marked row and the preferences hanging off it — is
   * unreachable: the friend profile route needs a friendship and the own list
   * needs a session, and neither exists any more.
   */
  app.delete("/", async (request, reply) => {
    const viewer = currentUser(request);

    await app.db.transaction(async (tx) => {
      const now = new Date();
      await tx
        .update(users)
        .set({
          deletedAt: now,
          updatedAt: now,
          email: `deleted-${viewer.id}@invalid`,
          handle: `deleted_${viewer.id}`,
          displayName: "Gelöschtes Konto",
          passwordHash: `deleted-${randomBytes(32).toString("base64url")}`,
        })
        .where(eq(users.id, viewer.id));

      await tx.delete(sessions).where(eq(sessions.userId, viewer.id));
      await tx.delete(emailTokens).where(eq(emailTokens.userId, viewer.id));
      // Other people's notes about this account lose their link immediately —
      // the ON DELETE SET NULL would only fire once the purge job runs.
      await tx
        .update(persons)
        .set({ linkedUserId: null, updatedAt: now })
        .where(eq(persons.linkedUserId, viewer.id));
      await tx
        .delete(friendships)
        .where(
          or(
            eq(friendships.userAId, viewer.id),
            eq(friendships.userBId, viewer.id),
          ),
        );
      await tx
        .delete(friendRequests)
        .where(
          or(
            eq(friendRequests.fromUserId, viewer.id),
            eq(friendRequests.toUserId, viewer.id),
          ),
        );
    });

    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });
}
