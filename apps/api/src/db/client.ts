import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>["db"];

/** The handle Drizzle hands to a `db.transaction` callback. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Anything statements can run on: the pool itself or an open transaction.
 * Helpers take this so a caller can decide whether their step is atomic with
 * the rest of the work — resetting a password destroys sessions and tokens in
 * one transaction, while the same helpers are called standalone elsewhere.
 */
export type Executor = Database | Transaction;

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
