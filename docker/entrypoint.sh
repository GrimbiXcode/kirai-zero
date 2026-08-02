#!/bin/sh
set -e

# Bring the database to the state this image expects before serving anything.
# Both steps are idempotent: migrations are tracked by Drizzle, and the
# catalogue seed only inserts entries that are missing.
#
# This assumes a single instance. Running several replicas against one database
# would need a lock around the migration — see docs/decisions.md.
if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "kirai-zero: applying migrations"
  node dist/db/migrate.js
  echo "kirai-zero: seeding catalogue"
  node dist/db/seed.js
fi

exec "$@"
