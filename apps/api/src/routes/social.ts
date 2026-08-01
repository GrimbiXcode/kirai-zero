import type { FastifyInstance } from "fastify";
import { and, asc, eq, inArray, ne, or } from "drizzle-orm";
import {
  friendRequestCreateSchema,
  isNegative,
  isPositive,
  userIdParamSchema,
  userSearchQuerySchema,
  uuidParamSchema,
  type FriendDto,
  type FriendRequestDto,
} from "shared";
import {
  friendRequests,
  friendships,
  items,
  preferences,
  users,
} from "../db/schema";
import { authenticate, currentUser } from "../lib/auth";
import { toItemDto, toPublicUser, toSharedPreferenceDto } from "../lib/dto";
import { badRequest, conflict, notFound } from "../lib/errors";
import {
  findFriendship,
  orderedPair,
  requireFriendship,
} from "../lib/friendship";
import { selectPreferenceColumns } from "../lib/queries";
import { parse } from "../lib/validate";

const publicUserColumns = {
  id: users.id,
  handle: users.handle,
  displayName: users.displayName,
};

export async function socialRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  /**
   * Prefix search on the handle only. Display names and email addresses are
   * deliberately not searchable: the handle is the identifier a user chooses
   * to be found by, everything else would make people discoverable without
   * having opted into it.
   */
  app.get("/users/search", async (request) => {
    const { handle } = parse(userSearchQuerySchema, request.query);
    const viewer = currentUser(request);

    const rows = await app.db
      .select(publicUserColumns)
      .from(users)
      .where(and(eq(users.handle, handle), ne(users.id, viewer.id)))
      .limit(10);

    const found = rows[0];
    if (!found) return { users: [] };

    const [friendship, pending] = await Promise.all([
      findFriendship(app.db, viewer.id, found.id),
      app.db
        .select({
          id: friendRequests.id,
          fromUserId: friendRequests.fromUserId,
        })
        .from(friendRequests)
        .where(
          and(
            eq(friendRequests.status, "pending"),
            or(
              and(
                eq(friendRequests.fromUserId, viewer.id),
                eq(friendRequests.toUserId, found.id),
              ),
              and(
                eq(friendRequests.fromUserId, found.id),
                eq(friendRequests.toUserId, viewer.id),
              ),
            ),
          ),
        )
        .limit(1),
    ]);

    const request_ = pending[0];
    const relation = friendship
      ? "friend"
      : request_
        ? request_.fromUserId === viewer.id
          ? "request_sent"
          : "request_received"
        : "none";

    return { users: [{ user: toPublicUser(found), relation }] };
  });

  app.post("/friend-requests", async (request, reply) => {
    const viewer = currentUser(request);
    const { handle } = parse(friendRequestCreateSchema, request.body);

    const targetRows = await app.db
      .select(publicUserColumns)
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1);
    const target = targetRows[0];
    if (!target) throw notFound("user_not_found", "No user with this handle");
    if (target.id === viewer.id) {
      throw badRequest("self_request", "Cannot befriend yourself");
    }

    if (await findFriendship(app.db, viewer.id, target.id)) {
      throw conflict("already_friends", "Already friends");
    }

    const existing = await app.db
      .select()
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.status, "pending"),
          or(
            and(
              eq(friendRequests.fromUserId, viewer.id),
              eq(friendRequests.toUserId, target.id),
            ),
            and(
              eq(friendRequests.fromUserId, target.id),
              eq(friendRequests.toUserId, viewer.id),
            ),
          ),
        ),
      )
      .limit(1);

    const open = existing[0];
    if (open) {
      // They asked first and we are now asking back: that is consent from both
      // sides, so complete the friendship instead of stacking two requests.
      if (open.fromUserId === target.id) {
        await acceptRequest(app, open.id, viewer.id, target.id);
        return reply.code(200).send({ status: "accepted" });
      }
      throw conflict("request_pending", "Request already sent");
    }

    const inserted = await app.db
      .insert(friendRequests)
      .values({ fromUserId: viewer.id, toUserId: target.id })
      .returning();

    const row = inserted[0]!;
    const dto: FriendRequestDto = {
      id: row.id,
      direction: "outgoing",
      user: toPublicUser(target),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
    return reply.code(201).send({ request: dto, status: "pending" });
  });

  app.get("/friend-requests", async (request) => {
    const viewer = currentUser(request);

    const rows = await app.db
      .select({
        id: friendRequests.id,
        fromUserId: friendRequests.fromUserId,
        toUserId: friendRequests.toUserId,
        status: friendRequests.status,
        createdAt: friendRequests.createdAt,
      })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.status, "pending"),
          or(
            eq(friendRequests.fromUserId, viewer.id),
            eq(friendRequests.toUserId, viewer.id),
          ),
        ),
      )
      .orderBy(asc(friendRequests.createdAt));

    const counterpartIds = rows.map((row) =>
      row.fromUserId === viewer.id ? row.toUserId : row.fromUserId,
    );
    const counterparts =
      counterpartIds.length > 0
        ? await app.db
            .select(publicUserColumns)
            .from(users)
            .where(inArray(users.id, counterpartIds))
        : [];
    const byId = new Map(counterparts.map((user) => [user.id, user]));

    const requests: FriendRequestDto[] = rows.flatMap((row) => {
      const outgoing = row.fromUserId === viewer.id;
      const counterpart = byId.get(outgoing ? row.toUserId : row.fromUserId);
      if (!counterpart) return [];
      return [
        {
          id: row.id,
          direction: outgoing ? "outgoing" : "incoming",
          user: toPublicUser(counterpart),
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        },
      ];
    });

    return {
      incoming: requests.filter((item) => item.direction === "incoming"),
      outgoing: requests.filter((item) => item.direction === "outgoing"),
    };
  });

  app.post("/friend-requests/:id/accept", async (request) => {
    const viewer = currentUser(request);
    const { id } = parse(uuidParamSchema, request.params);

    const row = await loadPendingRequest(app, id);
    if (row.toUserId !== viewer.id) {
      throw notFound("request_not_found", "No such request");
    }
    await acceptRequest(app, row.id, row.fromUserId, row.toUserId);
    return { ok: true };
  });

  app.post("/friend-requests/:id/decline", async (request) => {
    const viewer = currentUser(request);
    const { id } = parse(uuidParamSchema, request.params);

    const row = await loadPendingRequest(app, id);
    if (row.toUserId !== viewer.id) {
      throw notFound("request_not_found", "No such request");
    }
    await app.db
      .update(friendRequests)
      .set({ status: "declined", respondedAt: new Date() })
      .where(eq(friendRequests.id, row.id));
    return { ok: true };
  });

  app.delete("/friend-requests/:id", async (request) => {
    const viewer = currentUser(request);
    const { id } = parse(uuidParamSchema, request.params);

    const row = await loadPendingRequest(app, id);
    if (row.fromUserId !== viewer.id) {
      throw notFound("request_not_found", "No such request");
    }
    await app.db
      .update(friendRequests)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(eq(friendRequests.id, row.id));
    return { ok: true };
  });

  app.get("/friends", async (request) => {
    const viewer = currentUser(request);

    const rows = await app.db
      .select({
        friendsSince: friendships.createdAt,
        userAId: friendships.userAId,
        userBId: friendships.userBId,
      })
      .from(friendships)
      .where(
        or(
          eq(friendships.userAId, viewer.id),
          eq(friendships.userBId, viewer.id),
        ),
      );

    const friendIds = rows.map((row) =>
      row.userAId === viewer.id ? row.userBId : row.userAId,
    );
    if (friendIds.length === 0) return { friends: [] };

    const people = await app.db
      .select(publicUserColumns)
      .from(users)
      .where(inArray(users.id, friendIds))
      .orderBy(asc(users.displayName));
    const sinceById = new Map(
      rows.map((row) => [
        row.userAId === viewer.id ? row.userBId : row.userAId,
        row.friendsSince,
      ]),
    );

    const friends: FriendDto[] = people.map((person) => ({
      user: toPublicUser(person),
      friendsSince: (sinceById.get(person.id) ?? new Date()).toISOString(),
    }));
    return { friends };
  });

  app.delete("/friends/:userId", async (request) => {
    const viewer = currentUser(request);
    const { userId } = parse(userIdParamSchema, request.params);
    await requireFriendship(app.db, viewer.id, userId);

    const [userAId, userBId] = orderedPair(viewer.id, userId);
    await app.db
      .delete(friendships)
      .where(
        and(eq(friendships.userAId, userAId), eq(friendships.userBId, userBId)),
      );
    return { ok: true };
  });

  /**
   * The whole point of the product: what a friend likes and what they do not.
   * Access is gated on an existing friendship, and private entries are filtered
   * in SQL so they never leave the database on this path.
   */
  app.get("/friends/:userId/profile", async (request) => {
    const viewer = currentUser(request);
    const { userId } = parse(userIdParamSchema, request.params);
    const friendship = await requireFriendship(app.db, viewer.id, userId);

    const ownerRows = await app.db
      .select(publicUserColumns)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const owner = ownerRows[0];
    if (!owner) throw notFound("user_not_found", "No such user");

    const rows = await app.db
      .select(selectPreferenceColumns)
      .from(preferences)
      .innerJoin(items, eq(items.id, preferences.itemId))
      .where(
        and(
          eq(preferences.userId, userId),
          eq(preferences.visibility, "friends"),
        ),
      )
      .orderBy(asc(items.name));

    const shared = rows.map((row) =>
      toSharedPreferenceDto({ ...row, item: toItemDto(row.item) }),
    );

    // Both lists keep the alphabetical order the query already established;
    // with no reasons there is no entry that deserves to jump the queue.
    const likes = shared.filter((entry) => isPositive(entry.stance));
    const dislikes = shared.filter((entry) => isNegative(entry.stance));

    return {
      user: toPublicUser(owner),
      friendsSince: friendship.createdAt.toISOString(),
      likes,
      dislikes,
    };
  });
}

async function loadPendingRequest(app: FastifyInstance, id: string) {
  const rows = await app.db
    .select()
    .from(friendRequests)
    .where(and(eq(friendRequests.id, id), eq(friendRequests.status, "pending")))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound("request_not_found", "No such request");
  return row;
}

async function acceptRequest(
  app: FastifyInstance,
  requestId: string,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  const [userAId, userBId] = orderedPair(fromUserId, toUserId);
  await app.db.transaction(async (tx) => {
    await tx
      .update(friendRequests)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(friendRequests.id, requestId));
    await tx
      .insert(friendships)
      .values({ userAId, userBId })
      .onConflictDoNothing({
        target: [friendships.userAId, friendships.userBId],
      });
  });
}
