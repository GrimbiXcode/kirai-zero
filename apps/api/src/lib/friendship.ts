import { and, eq, or } from "drizzle-orm";
import type { Database } from "../db/client";
import { friendships } from "../db/schema";
import { notFound } from "./errors";

/**
 * Friendships are stored once with the two ids sorted, so every read and write
 * has to go through this to hit the unique index.
 */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function findFriendship(
  db: Database,
  viewerId: string,
  otherId: string,
): Promise<{ createdAt: Date } | null> {
  if (viewerId === otherId) return null;
  const [userAId, userBId] = orderedPair(viewerId, otherId);
  const rows = await db
    .select({ createdAt: friendships.createdAt })
    .from(friendships)
    .where(
      and(eq(friendships.userAId, userAId), eq(friendships.userBId, userBId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function areFriends(
  db: Database,
  viewerId: string,
  otherId: string,
): Promise<boolean> {
  return (await findFriendship(db, viewerId, otherId)) !== null;
}

/**
 * The single gate in front of everything another user's data flows through.
 * Answers 404 rather than 403 so the API does not confirm that an account
 * exists to someone who is not connected to it.
 */
export async function requireFriendship(
  db: Database,
  viewerId: string,
  otherId: string,
): Promise<{ createdAt: Date }> {
  const friendship = await findFriendship(db, viewerId, otherId);
  if (!friendship) {
    throw notFound("friend_not_found", "No friendship with this user");
  }
  return friendship;
}

export function friendshipFilter(userId: string) {
  return or(
    eq(friendships.userAId, userId),
    eq(friendships.userBId, userId),
  );
}
