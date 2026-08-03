import { isNotNull } from "drizzle-orm";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import { purgeExpiredEmailTokens } from "./email-tokens";
import { purgeExpiredSessions } from "./sessions";

/**
 * Erases accounts that were marked for deletion. There is no waiting period:
 * the 24 hours in the privacy concept are the promised upper bound, not a
 * grace period — by the time a row is marked, the person has already lost
 * access and their data is invisible to everyone else.
 *
 * The cascades declared in the schema do the rest: preferences go with the
 * row, and `items.created_by` falls back to null so catalogue entries other
 * people rely on stay intact.
 */
export async function purgeDeletedAccounts(db: Database): Promise<number> {
  const deleted = await db
    .delete(users)
    .where(isNotNull(users.deletedAt))
    .returning({ id: users.id });
  return deleted.length;
}

export interface HousekeepingResult {
  purgedAccounts: number;
}

/** Retention work that runs on start-up and then hourly. */
export async function runHousekeeping(
  db: Database,
): Promise<HousekeepingResult> {
  await purgeExpiredSessions(db);
  await purgeExpiredEmailTokens(db);
  const purgedAccounts = await purgeDeletedAccounts(db);
  return { purgedAccounts };
}
