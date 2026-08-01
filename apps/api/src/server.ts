import { buildApp } from "./app";
import { createDatabase } from "./db/client";
import { loadEnv } from "./env";
import { purgeExpiredSessions } from "./lib/sessions";

const env = loadEnv();
const { db, sql } = createDatabase(env.DATABASE_URL);
const app = await buildApp({ db, env });

// Retention housekeeping: expired sessions are removed on start and hourly.
await purgeExpiredSessions(db);
const purgeTimer = setInterval(
  () => {
    purgeExpiredSessions(db).catch((error) =>
      app.log.error({ err: error }, "session purge failed"),
    );
  },
  60 * 60 * 1000,
);
purgeTimer.unref();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  clearInterval(purgeTimer);
  await app.close();
  await sql.end();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ port: env.PORT, host: "0.0.0.0" });
