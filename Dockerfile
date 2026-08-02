# One image for the whole app: the API process also serves the built web
# client. That keeps a deployment to a single container plus Postgres, and it
# puts everything on one origin — no CORS, and the session cookie is same-site
# without special cases.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app


FROM base AS build
# Playwright is a dev dependency of the web workspace; the build has no use for
# a browser and should not spend two minutes fetching one.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Manifests first: this layer only changes when a dependency changes, so the
# install stays cached across ordinary source edits.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .

# Empty base URL means the client talks to its own origin — which is exactly
# what this image serves.
ENV VITE_API_URL=""
RUN pnpm --filter api build && pnpm --filter web build

# A tree with production dependencies only: no vitest, no tsup, no Playwright.
RUN pnpm --filter api --prod --legacy deploy /out


FROM base AS runtime
ENV NODE_ENV=production
# The API reads the client from here; see apps/api/src/app.ts.
ENV WEB_ROOT=/app/web
ENV PORT=3000

COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
# The SQL migrations are data, not code — tsup does not bundle them, and
# dist/db/migrate.js resolves them relative to itself.
COPY --from=build /app/apps/api/drizzle ./drizzle
COPY --from=build /app/apps/web/dist ./web
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh && chown -R node:node /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/server.js"]
