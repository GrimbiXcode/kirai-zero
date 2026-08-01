import { buildApp } from "./app";
import { createDatabase } from "./db/client";
import { loadEnv } from "./env";
import { runHousekeeping } from "./lib/housekeeping";

const env = loadEnv();
const { db, sql } = createDatabase(env.DATABASE_URL);
const app = await buildApp({ db, env });

// Retention: expired sessions and accounts marked for deletion are erased on
// start-up and then hourly. Only counts are logged, never an identifier.
const housekeeping = () =>
  runHousekeeping(db)
    .then(({ purgedAccounts }) => {
      if (purgedAccounts > 0) {
        app.log.info({ purgedAccounts }, "purged deleted accounts");
      }
    })
    .catch((error: unknown) =>
      app.log.error({ err: error }, "housekeeping failed"),
    );

await housekeeping();
const purgeTimer = setInterval(housekeeping, 60 * 60 * 1000);
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
