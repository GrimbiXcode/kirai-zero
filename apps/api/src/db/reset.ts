import { sql as raw } from "drizzle-orm";
import { createDatabase } from "./client";

/**
 * Empties every account and everything attached to it, keeping the seeded
 * catalogue. Meant for test and end-to-end databases only.
 *
 * Guarded by the database name: a script that truncates tables has no business
 * being able to run against production, however it is invoked.
 */
const ALLOWED_SUFFIXES = ["_test", "_e2e"];

export function assertDisposableDatabase(connectionString: string): void {
  const name = new URL(connectionString).pathname.replace(/^\//, "");
  if (!ALLOWED_SUFFIXES.some((suffix) => name.endsWith(suffix))) {
    throw new Error(
      `Refusing to reset "${name}": only databases ending in ${ALLOWED_SUFFIXES.join(
        " or ",
      )} may be reset.`,
    );
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

assertDisposableDatabase(connectionString);

const { db, sql } = createDatabase(connectionString, 1);
try {
  // Not TRUNCATE ... CASCADE on users: items.created_by references users, so
  // cascading would take the catalogue with it.
  await db.execute(
    raw`TRUNCATE TABLE sessions, email_tokens, preferences, friend_requests, friendships`,
  );
  await db.execute(raw`DELETE FROM items WHERE is_curated = false`);
  await db.execute(raw`DELETE FROM users`);
  console.log("Database reset; catalogue kept.");
} finally {
  await sql.end();
}
