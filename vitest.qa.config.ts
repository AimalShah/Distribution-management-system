/**
 * Vitest config for the API-level domain-correctness and reconciliation suites
 * under `qa/` (Phases 2 and 3 of the QA plan).
 *
 * This is the real server (`createApp`) against a real PostgreSQL — the same
 * shape the checkpoint parity suites use — but pointed at a dedicated LOCAL
 * test database, never the developer's `.env` target (which points at Neon).
 * `qa/support/setup.ts` resolves and guards the URL before any test module
 * loads; a non-local host is a hard failure, not a skip.
 */
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      // Exact-specifier aliases (see the comment in the root `vitest.config.ts`
      // for why the object form is unusable).
      { find: /^@dms\/db$/, replacement: path.resolve(__dirname, "packages/db/src/index.ts") },
      { find: /^@dms\/db\/debug-log$/, replacement: path.resolve(__dirname, "packages/db/src/debug-log.ts") },
      { find: /^@dms\/shared$/, replacement: path.resolve(__dirname, "packages/shared/src/index.ts") },
      { find: /^@dms\/ui$/, replacement: path.resolve(__dirname, "packages/ui/src/index.ts") },
      // The P0-7 destructive-guard module, reused verbatim by the harness: a
      // non-local host must stop these suites before they connect.
      {
        find: /^@dms\/db-target$/,
        replacement: path.resolve(__dirname, "packages/db/prisma/db-target.ts"),
      },
    ],
  },
  test: {
    include: ["qa/**/*.test.ts"],
    environment: "node",
    // The suites drive real transactions (Serializable, concurrency pairs);
    // late-joining Postgres migrations and contention deserve more than 5 s.
    testTimeout: 30_000,
    // A failed invariant should show the numbers, not truncate them.
    disableConsoleIntercept: true,
    setupFiles: ["qa/support/setup.ts"],
  },
});
