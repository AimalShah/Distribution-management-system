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
  /**
   * Directory name directly under `checkpoints/`, or one sub-checkpoint inside
   * it (`04-react-web-app/04a-dashboard`). The more specific entry wins, so a
   * sub-checkpoint can be gated while the rest of its parent stays pending.
   */
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
    dir: "04-react-web-app",
    status: "pending",
    reason:
      "`apps/web` is a 4-file shell with no screens, so the ten suites have nothing to assert against. Blocked on 01 (shared UI, now landed) and 03 (real sessions).",
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
  return GATED_DIRS.flatMap((dir) =>
    dir.includes("/")
      ? [`checkpoints/${dir}/parity.test.ts`]
      : [`checkpoints/${dir}/parity.test.ts`, `checkpoints/${dir}/*/parity.test.ts`]
  );
}

/**
 * The gate entry a parity test answers to: its sub-checkpoint's entry when one
 * exists, otherwise its checkpoint's. `undefined` when neither has an entry.
 */
export function owningEntry(testPath: string): string | undefined {
  const parts = testPath.split("/"); // checkpoints/<dir>[/<subdir>]/parity.test.ts
  const dirs = GATE.map((e) => e.dir);
  const sub = parts.length > 3 ? `${parts[1]}/${parts[2]}` : undefined;
  if (sub && dirs.includes(sub)) return sub;
  return dirs.includes(parts[1]) ? parts[1] : undefined;
}
