/**
 * The harness router lives in `src/harness/router.ts` -- that is the path
 * `checkpoints/00-harness-monorepo-scaffold/parity.test.ts` asserts, and it is
 * where the endpoint contract belongs.
 *
 * This module keeps the `debugRouter` name that `app.ts` mounts at `/__debug`
 * (dev only) so the mount site and its path stay readable.
 */
export { harnessRouter as debugRouter } from "../harness/router";
