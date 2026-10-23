/**
 * Populate the database URL before any test module loads, then refuse a
 * non-local target with the P0-7 guard.
 *
 * Ordering is the whole point. `packages/db/src/client.ts` constructs the
 * Prisma client at import time and Prisma reads `DATABASE_URL` then, so the
 * variable must be set here — `setupFiles` run before the module graph loads
 * — and nowhere else.
 *
 * SAFETY CONTRACT (same boundary the Phase-2/3 suites cannot cross):
 *
 * These suites create and destroy tenants, but on a shared database. The
 * developer's `.env` points at Neon; nothing in this harness may ever fall
 * back to that file. The URL resolution is therefore explicit:
 *
 *   1. `QA_TEST_DATABASE_URL` — wins, whatever it says;
 *   2. an already-set `DATABASE_URL` kept, but only after the guard accepts it
 *      as local;
 *   3. the local Docker default (`dms_qa_test` on this machine).
 *
 * A remote host (Neon, RDS, …) is a hard vitest failure, never a warning —
 * a suite told to skip is a green summary row that checked nothing.
 */
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(__dirname, "..", "..");

/** The local Docker Compose Postgres; `qa/setup-db.mjs` migrates this database. */
const LOCAL_DEFAULT =
  "postgresql://medusa_db:pass1234@localhost:5432/dms_qa_test";

const explicit = process.env.QA_TEST_DATABASE_URL?.trim();
const fromEnv = process.env.DATABASE_URL?.trim();

if (explicit) {
  process.env.DATABASE_URL = explicit;
  process.env.DATABASE_URL_UNPOOLED = explicit;
} else if (!fromEnv) {
  process.env.DATABASE_URL = LOCAL_DEFAULT;
  // Forced (not ||=): the Prisma client's datasource has a `directUrl`, and a
  // leftover remote UNPOOLED value would silently repoint migrations/reads.
  process.env.DATABASE_URL_UNPOOLED = LOCAL_DEFAULT;
}

// Dynamic, not static: a static import would evaluate before the assignments
// above and the module graph's load-env could plant the developer's `.env`
// (Neon) URL first. The alias resolves the P0-7 guard itself.
const { assertLocalDatabase } = await import("@dms/db-target");

// Throws with the offending host in the message when the target is remote.
assertLocalDatabase("qa domain suites");

// The suites below stand behind the read-order barrier Prisma needs, so the
// schema must exist, the service must be up, and the migrations must be
// applied. `pnpm db:test:migrate` does all three locally.
const { prisma } = await import("@dms/db");

try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  throw new Error(
    `the local test database is unreachable: ${(error as Error).message}\n` +
      "Run `pnpm db:test:migrate` to create/apply migrations on the local dms_qa_test database."
  );
}
