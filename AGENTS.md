# Working on kirai-zero

Notes for anyone — human or agent — picking this repository up. Conventions
that are not obvious from the code, and the handful of rules that are load
bearing.

## What the app is

People record what they like and what they would not eat or would throw away,
and share it with confirmed friends. Two jobs: gifts that do not end up in the
bin, and meals that do not miss the guests' taste. Everything else follows from
that.

## Layout

```
apps/api        Fastify + Drizzle + PostgreSQL
apps/web        Vite + React, PWA, Capacitor wrapper
packages/shared Zod schemas, enums and types used by both
docs/           privacy concept, risk assessment, decision log
```

`docs/decisions.md` is the first thing to read before changing anything
structural. It records *why*, and several entries are marked superseded rather
than deleted — the history of a decision matters as much as its outcome.

## Rules that must not be broken

1. **Never widen who can see someone's entries.** Access to another person's
   data goes through `requireFriendship` (`apps/api/src/lib/friendship.ts`) and
   `requirePerson` (`apps/api/src/lib/persons.ts`). Both answer **404**, not
   403: confirming that an account or a profile exists is itself a disclosure.
2. **Private entries stay private.** `visibility = 'private'` must be filtered
   in SQL, never in the client, and must be indistinguishable from "no entry"
   — including in the note comparison on a person profile.
3. **No third-party requests.** No analytics, no CDN, no remote fonts, no error
   telemetry. The API sends `default-src 'self'` and the app must satisfy it.
4. **Do not collect what the product does not need.** No IP addresses in
   sessions or logs, no user agent, no phone number, no date of birth. Adding a
   column means adding an entry to the processing record in
   `docs/privacy-concept.md`.
5. **Do not add a field asking *why* someone dislikes something.** That field
   existed and was removed on purpose; it made the app process health data and
   beliefs under Art. 9 GDPR. See `docs/decisions.md`, entry 11.

Every one of these has tests. If a change makes one fail, the change is wrong
until proven otherwise.

## Conventions

- **Imports carry no `.js` extension.** `packages/shared` is consumed as
  TypeScript source with `moduleResolution: "bundler"`; drizzle-kit cannot map
  the extension back. See `docs/decisions.md`, entry 8.
- **UI text lives in `apps/web/src/i18n/de.json`**, flat keys, no i18n library.
  Enum values double as the second half of their key (`lists.stance.dislike`),
  so `apps/web/src/lib/labels.ts` breaks the typecheck when a new enum value
  has no translation. That is the point — do not work around it.
- **Comments explain why, not what.** The codebase is deliberately light on
  narration and heavy on the two or three sentences that keep someone from
  undoing a decision by accident.
- **Errors carry a stable `code`.** The client maps it to a translated message;
  `message` is a developer hint and is never shown to a user.

## Schema changes

```bash
pnpm --filter api db:generate    # writes apps/api/drizzle/NNNN_name.sql
```

**Read the generated SQL before committing it.** drizzle-kit produces the
structural change but no data migration — dropping an enum value, for example,
generates a cast that fails on existing rows. `0002_drop_reason_and_consent.sql`
shows the hand-written `UPDATE` such a case needs.

## Tests

```bash
docker compose up -d postgres
pnpm test        # API integration tests + web unit tests
pnpm test:e2e    # Playwright against the real stack
pnpm typecheck
```

The API tests share one database and truncate between cases; `resetData` in
`apps/api/test/helpers.ts` deliberately avoids `TRUNCATE ... CASCADE`, which
would take the seeded catalogue with it.

Write tests for the access rules, not just the happy path. The valuable ones in
this repository are the negative cases: a stranger gets 404, a private entry
stays unconfirmed, unfriending revokes access in the same transaction.

If a Playwright browser mismatch blocks the run:
`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium pnpm test:e2e`.

## Container and CI

One image serves the API *and* the built web client from a single origin — no
CORS, no cross-site cookie handling. `WEB_ROOT` switches that on; it is unset
in development, where Vite serves the client itself.

- `.github/workflows/test.yml` — typecheck, tests and the end-to-end run on
  every push and pull request
- `.github/workflows/docker.yml` — on `main`: build the image and start it once
  against a database; on a `v*` tag: build and push to ghcr.io

The container runs migrations and the catalogue seed before serving. Both are
idempotent, and both assume **one instance** — several replicas against one
database would need a lock around the migration.

## Language

Code, comments and commit messages in English. UI text and the documents under
`docs/` in German, because that is who they are for.
