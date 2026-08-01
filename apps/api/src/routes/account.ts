import type { FastifyInstance } from "fastify";
import { asc, eq, inArray, or } from "drizzle-orm";
import {
  friendRequests,
  friendships,
  items,
  preferences,
  users,
} from "../db/schema";
import { authenticate, currentUser } from "../lib/auth";
import { toItemDto, toPreferenceDto } from "../lib/dto";
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
    };
  });

  /**
   * Art. 17 GDPR, executed immediately rather than flagged for later: sessions,
   * preferences, friendships and requests are removed by cascade. Catalogue
   * items this user contributed stay, with the authorship dropped — deleting
   * them would silently break other people's preference lists.
   */
  app.delete("/", async (request, reply) => {
    const viewer = currentUser(request);
    await app.db.delete(users).where(eq(users.id, viewer.id));
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });
}
