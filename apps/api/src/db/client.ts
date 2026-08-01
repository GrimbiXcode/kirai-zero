import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>["db"];

export function createDatabase(connectionString: string, maxConnections = 10) {
  const sql = postgres(connectionString, {
    max: maxConnections,
    // Server-side prepared statements collide with connection poolers such as
    // PgBouncer in transaction mode; the query volume here does not need them.
    prepare: false,
    onnotice: () => {},
  });
  const db = drizzle(sql, { schema });
  return { db, sql };
}
