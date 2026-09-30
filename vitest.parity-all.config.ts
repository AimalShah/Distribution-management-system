import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Every checkpoint parity suite, gated or not.
 *
 * This is a progress view, not a gate: the `pending` suites in
 * `checkpoints/parity-gate.ts` fail here by design, and several of them will
 * keep failing until the checkpoints they cover are built. It exists so that
 * work on a pending checkpoint can be measured against the whole set, and so
 * a suite that starts failing for a new reason is visible before it is
 * promoted to `gated`.
 *
 * `vitest.config.ts` is what CI enforces.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@dms\/db$/, replacement: path.resolve(__dirname, "packages/db/src/index.ts") },
      { find: /^@dms\/db\/debug-log$/, replacement: path.resolve(__dirname, "packages/db/src/debug-log.ts") },
      { find: /^@dms\/shared$/, replacement: path.resolve(__dirname, "packages/shared/src/index.ts") },
      { find: /^@dms\/ui$/, replacement: path.resolve(__dirname, "packages/ui/src/index.ts") },
    ],
  },
  test: {
    include: [
      "checkpoints/parity-gate.test.ts",
      // Both shapes a checkpoint takes: a suite directly in the directory
      // (`01-shared-packages/`) and one per subdirectory
      // (`02-express-api/02a-product/`, `04-react-web-app/04a-dashboard/`).
      // Checkpoints 05-12 hold `acceptance.test.ts`, not `parity.test.ts`, so
      // they are not picked up here either.
      "checkpoints/*/parity.test.ts",
      "checkpoints/*/*/parity.test.ts",
    ],
    environment: "node",
  },
});
