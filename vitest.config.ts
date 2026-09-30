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
 * `turbo run test`, because `apps/server` mocks `@dms/db`. The parity suites
 * that need a database say so and are `pending` in the gate until they are
 * rewritten to stand on their own.
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
      ...parityTestGlobs(),
    ],
    environment: "node",
  },
});
