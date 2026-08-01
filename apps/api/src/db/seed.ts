import { fileURLToPath } from "node:url";
import path from "node:path";
import { slugify } from "shared";
import type { ItemKind } from "shared";
import { createDatabase, type Database } from "./client";
import { CURATED_ITEMS } from "./catalog";
import { items } from "./schema";

/**
 * Idempotent: re-running only adds catalogue entries that are missing, so it is
 * safe to call after every deploy that extends the catalogue.
 */
export async function seedCatalog(db: Database): Promise<number> {
  const rows = Object.entries(CURATED_ITEMS).flatMap(([kind, names]) =>
    names.map((name) => ({
      kind: kind as ItemKind,
      name,
      slug: slugify(name),
      isCurated: true,
    })),
  );
  if (rows.length === 0) return 0;

  const inserted = await db
    .insert(items)
    .values(rows)
    .onConflictDoNothing({ target: [items.kind, items.slug] })
    .returning({ id: items.id });

  return inserted.length;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const { db, sql } = createDatabase(connectionString, 1);
  try {
    const count = await seedCatalog(db);
    console.log(`Seeded ${count} new catalogue items.`);
  } finally {
    await sql.end();
  }
}
