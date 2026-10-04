import { defineConfig } from "vitest/config";
import path from "node:path";

import { parityTestGlobs } from "./checkpoints/parity-gate";

/**
 * Root Vitest config for the checkpoint fitness functions. This is the config
 * CI enforces: it runs the suites listed in `checkpoints/parity-gate.ts` and
 * nothing else.
 *
 * For the whole set, including the checkpoints still marked `pending`, use
 * `pnpm run test:parity:all` (`vitest.parity-all.config.ts`).
 *
 * `checkpoints/` is deliberately outside the pnpm workspace globs
 * (`apps/*`, `packages/*`), so there is no `node_modules` under it and no
 * `@dms/*` package is resolvable from a test file in there. Vitest resolves
 * these aliases itself, which is what lets the parity tests import the real
 * `createApp` and the real shared schemas rather than a copy of either.
 *
 * The package unit suites stay in their own workspaces and run via
 * `turbo run test`, because `apps/server` mocks `@dms/db`. The Checkpoint 2
 * suites are the opposite case: they stand on their own against a real database
 * and are `gated` here, so the tests that can pass without one (a mocked
 * Prisma) are not what this job checks.
 */
export default defineConfig({
  resolve: {
    // Array form with anchored regexes, not the object form. `@dms/db` as an
    // object key is a *prefix* match, so it swallows `@dms/db/debug-log` and
    // rewrites it to `.../packages/db/src/index.ts/debug-log` -- a path that does
    // not exist. Anchoring each alias to its exact specifier avoids the overlap,
    // and the order no longer matters.
    alias: [
      { find: /^@dms\/db$/, replacement: path.resolve(__dirname, "packages/db/src/index.ts") },
      { find: /^@dms\/db\/debug-log$/, replacement: path.resolve(__dirname, "packages/db/src/debug-log.ts") },
      { find: /^@dms\/shared$/, replacement: path.resolve(__dirname, "packages/shared/src/index.ts") },
      { find: /^@dms\/ui$/, replacement: path.resolve(__dirname, "packages/ui/src/index.ts") },
    ],
  },
  test: {
    include: [
      // Unconditional: the gate's own consistency check.
      "checkpoints/parity-gate.test.ts",
      // Also unconditional. The Checkpoint 2 suites skip themselves when no
      // database resolves, and a skipped suite reads as a passing one in the job
      // summary -- which is the failure mode this job already had once. This
      // turns "no database in CI" into a red job with a message that says which
      // workflow step to look at. Now that 02x is `gated` this file is not
      // optional bookkeeping either: without it, dropping the database service
      // would turn 252 gated assertions into 252 skips and the job would stay
      // green.
      "checkpoints/support/requires-database.test.ts",
      ...parityTestGlobs(),
    ],
    environment: "node",
    // Runs before any test module is imported, which is the only point at which
    // this can work: `packages/db/src/client.ts` constructs the Prisma client at
    // import time and Prisma reads DATABASE_URL then. A `.env` fallback belongs
    // in a setup file rather than inside a test helper for that reason -- by the
    // time a helper runs, the client already exists.
    setupFiles: ["checkpoints/support/load-env.ts"],
  },
});
