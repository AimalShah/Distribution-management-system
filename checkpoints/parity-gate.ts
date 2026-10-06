/**
 * Which checkpoint parity suites CI is allowed to gate on.
 *
 * Before this file existed, `fitness-functions.yml` ran a `pnpm vitest` that
 * matched no files, and the job had never been green for a reason nobody could
 * see: the root had no `vitest` dependency, so `pnpm vitest` resolved nothing
 * and the step died before a single test ran. Two of those suites were also
 * still the originals: `00`'s only assertion was `expect(true).toBe(true)`, and
 * every `02x` suite authenticated with `Authorization: Bearer <token>` against
 * an API that reads `x-organization-id`. So "the gate passed" and "the gate
 * never executed" were indistinguishable from the workflow file alone.
 *
 * The fix is not to loosen the gate until it is green -- that is what made the
 * original job worthless. It is to make the gate say out loud which checkpoints
 * it is actually enforcing, and to fail when a new one appears without a
 * decision. `parity-gate.test.ts` enforces the second half; this file is the
 * first half.
 *
 * `pending` is not a synonym for "skipped, ignore it". Each entry carries the
 * reason it is not yet enforced, so promoting one to `gated` is a real change
 * in a diff rather than a silent redefinition of what CI checks.
 */

export type GateStatus = "gated" | "pending";

export interface GateEntry {
  /** Directory name directly under `checkpoints/`. */
  readonly dir: string;
  readonly status: GateStatus;
  /** Required when `status` is `pending`: what has to land first. */
  readonly reason?: string;
}

export const GATE: readonly GateEntry[] = [
  {
    dir: "00-harness-monorepo-scaffold",
    status: "gated",
  },
  {
    dir: "01-shared-packages",
    status: "gated",
  },
  {
    dir: "02-express-api",
    status: "gated",
  },
  {
    dir: "03-auth",
    status: "gated",
  },
  // A checkpoint is gated one subdirectory at a time when its suites land
  // separately. `dir` may therefore be a path under `checkpoints/` rather than
  // only a directory name; `owningDir` in the test matches a suite to the
  // longest entry that prefixes it, so `04a` reads as gated while the nine
  // stubs beside it still read as pending.
  {
    dir: "04-react-web-app/04a-dashboard",
    status: "gated",
  },
  {
    dir: "04-react-web-app/04b-product",
    status: "gated",
  },
  {
    dir: "04-react-web-app/04c-purchase",
    status: "gated",
  },
  {
    dir: "04-react-web-app/04d-sale-invoice",
    status: "gated",
  },
  {
    dir: "04-react-web-app/04e-inventory",
    status: "gated",
  },
  {
    dir: "04-react-web-app/04f-returns",
    status: "gated",
  },
  {
    dir: "04-react-web-app/04g-customer",
    status: "gated",
  },
  {
    dir: "04-react-web-app/04h-supplier",
    status: "gated",
  },
  {
    dir: "04-react-web-app/04i-reports",
    status: "gated",
  },
  {
    dir: "04-react-web-app/04j-settings",
    status: "gated",
  },
  {
    dir: "13-invenza-ui-dashboard",
    status: "gated",
  },
  {
    dir: "05-electron-shell",
    status: "gated",
  },
  {
    dir: "04-react-web-app",
    status: "pending",
    reason:
      "All sub-checkpoints 04a-dashboard through 04j-settings are gated individually above. Top-level placeholder remains pending until entire suite is collapsed.",
  },
];

/** Enforced by CI. */
export const GATED_DIRS: readonly string[] = GATE.filter((e) => e.status === "gated").map(
  (e) => e.dir
);

export const PENDING_DIRS: readonly string[] = GATE.filter(
  (e) => e.status === "pending"
).map((e) => e.dir);

/**
 * Every parity test path, relative to the repo root, POSIX separators.
 *
 * A gated checkpoint may hold `parity.test.ts` directly or in subdirectories
 * (`02-express-api/02a-product/`, `04-react-web-app/04a-dashboard/`), so both
 * shapes are globbed.
 */
export function parityTestGlobs(): string[] {
  return GATED_DIRS.flatMap((dir) => [
    `checkpoints/${dir}/parity.test.ts`,
    `checkpoints/${dir}/*/parity.test.ts`,
  ]);
}
