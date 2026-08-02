import { defineConfig } from "tsup";

export default defineConfig({
  // The server plus the two maintenance entrypoints the container runs before
  // it starts serving.
  entry: ["src/server.ts", "src/db/migrate.ts", "src/db/seed.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  // `shared` is a source-only workspace package with no build step of its own
  // (see docs/decisions.md, entry 8). Left external, the bundle would import
  // TypeScript from node_modules at runtime, which Node refuses to load.
  noExternal: ["shared"],
});
