import { runMigrations } from "../src/db/migrate";
import { createDatabase } from "../src/db/client";
import { seedCatalog } from "../src/db/seed";
import { TEST_DATABASE_URL } from "./helpers";

/**
 * Migrates and seeds the test database once per run. Tests then truncate the
 * mutable tables between cases and keep the seeded catalogue.
 */
export default async function setup(): Promise<void> {
  await runMigrations(TEST_DATABASE_URL);
  const { db, sql } = createDatabase(TEST_DATABASE_URL, 1);
  try {
    await seedCatalog(db);
  } finally {
    await sql.end();
  }
}
