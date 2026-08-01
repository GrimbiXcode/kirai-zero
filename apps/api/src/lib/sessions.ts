import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { Database } from "../db/client";
import { sessions, users } from "../db/schema";

export const SESSION_COOKIE = "kirai_session";
export const SESSION_TTL_DAYS = 30;

/** Only touch `last_seen_at` once an hour so reads do not turn into writes. */
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

export interface AuthenticatedUser {
  id: string;
  handle: string;
  displayName: string;
  email: string;
  locale: string;
  createdAt: Date;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiry(from = new Date()): Date {
  return new Date(from.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function createSession(
  db: Database,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = sessionExpiry();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return { token, expiresAt };
}

export async function resolveSession(
  db: Database,
  token: string,
): Promise<AuthenticatedUser | null> {
  const now = new Date();
  const rows = await db
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      id: users.id,
      handle: users.handle,
      displayName: users.displayName,
      email: users.email,
      locale: users.locale,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, now),
        // Deleting an account already removes its sessions; this makes sure a
        // marked account cannot authenticate even if one turns up anyway.
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (now.getTime() - row.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: sessionExpiry(now) })
      .where(eq(sessions.id, row.sessionId));
  }

  return {
    id: row.id,
    handle: row.handle,
    displayName: row.displayName,
    email: row.email,
    locale: row.locale,
    createdAt: row.createdAt,
  };
}

export async function destroySession(
  db: Database,
  token: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function destroyAllSessions(
  db: Database,
  userId: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Housekeeping for the retention policy: expired sessions are not kept. */
export async function purgeExpiredSessions(db: Database): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
