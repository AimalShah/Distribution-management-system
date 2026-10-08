/**
 * Proves the Checkpoint 2 parity suites ran instead of skipped.
 *
 * `checkpoints/support/parity-db.ts` lets a suite skip when no database resolves,
 * which is a real convenience locally -- `pnpm run test:parity` should not demand
 * a running PostgreSQL for a developer who only wants the UI gate. But that same
 * behaviour is the exact failure this checkpoint already suffered once: the
 * original `checkpoint-parity` job reported green while its vitest invocation
 * resolved no files at all. "Green because it ran" and "green because nothing ran"
 * looked identical from the workflow file.
 *
 * So the skip is allowed locally and forbidden in CI, and this file is where that
 * distinction is enforced. It is included unconditionally by `vitest.config.ts`,
 * alongside `parity-gate.test.ts`, for the same reason: a guard that only runs
 * when the thing it guards is already healthy is not a guard.
 *
 * ## What it checks
 *
 * Not just that `DATABASE_URL` is set. The workflow exports that variable whether
 * or not the `postgres` service came up, and a `DATABASE_URL` pointing at a
 * server that is not listening yet fails the suites with a connection error that
 * reads like a code bug. Nor does a set variable prove the schema is there -- drop
 * the `migrate deploy` step and every 02x suite fails on a missing relation, 15
 * times over, with a message about `Product` rather than about the workflow.
 *
 * So it proves three things, in the order they fail:
 *
 *   1. a `DATABASE_URL` resolved;
 *   2. a query actually completes (the service is up and reachable);
 *   3. `Product` is queryable (the baseline migration was applied).
 *
 * Each failure names the workflow step or the command that fixes it, because a
 * CI failure whose message does not say what to change is a CI failure that gets
 * worked around instead of fixed.
 */
import { describe, expect, it } from "vitest";

import { hasDatabase, prisma, skipReason } from "./parity-db";

/**
 * Strict when CI is gating. Locally the suites are allowed to skip; in CI a skip
 * is indistinguishable from a pass in the job summary, so it is treated as the
 * failure it is.
 */
const enforcing = Boolean(process.env.CI);

describe("Checkpoint 2 — database requirement", () => {
  it("resolves a DATABASE_URL", () => {
    if (!hasDatabase) {
      const message =
        (enforcing
          ? "The Checkpoint 2 parity suites would skip, and a skipped suite is " +
            "indistinguishable from a passing one in this job. Check the " +
            "`services.postgres` block and the `env.DATABASE_URL` in " +
            "`.github/workflows/fitness-functions.yml`. Locally, " +
            `${skipReason}.`
          : `Allowed locally -- ${skipReason}.`);

      // Locally this is reported and tolerated. In CI it is the whole point.
      if (enforcing) throw new Error(message);

      return;
    }

    expect(hasDatabase).toBe(true);
  });

  it("can run a query against the database", async () => {
    if (!hasDatabase) return;

    try {
      await prisma.organization.count();
    } catch (error) {
      const message =
        "DATABASE_URL is set but the database did not answer a query. " +
        "The `postgres` service is probably not up yet, or is not reachable at " +
        "the host in DATABASE_URL. The service block uses a `pg_isready` health " +
        "check for exactly this; do not replace it with a sleep.";

      if (enforcing) throw new Error(`${message}\n\n${String(error)}`);

      return;
    }

    expect(true).toBe(true);
  });

  it("has the baseline migration applied", async () => {
    if (!hasDatabase) return;

    try {
      // Querying a model is the check: it raises if the relation is absent, which
      // is precisely the state a missing `migrate deploy` leaves the database in.
      // Probing the migration table instead would confirm the bookkeeping without
      // confirming the tables.
      await prisma.product.count();
    } catch (error) {
      const message =
        "The `Product` relation is not queryable, so the baseline migration has " +
        "not been applied to this database. Run `pnpm run db:migrate` locally, or " +
        "restore the `prisma migrate deploy` step in the checkpoint-parity job.";

      if (enforcing) throw new Error(`${message}\n\n${String(error)}`);

      return;
    }

    expect(true).toBe(true);
  });
});
