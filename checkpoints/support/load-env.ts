/**
 * Populate `DATABASE_URL` before any test module is imported.
 *
 * Vitest does not load `.env` files for the suites these configs include, and
 * `dotenv` is not a workspace dependency. The Checkpoint 2 parity suites need a
 * real database, so something has to read the repository-root `.env`.
 *
 * This is a `setupFiles` entry rather than a call inside `parity-db.ts` because
 * of import order. `packages/db/src/client.ts` runs `new PrismaClient()` at module
 * scope, and Prisma resolves `DATABASE_URL` in that constructor. A test helper is
 * evaluated after its own imports, so assigning the variable there is already too
 * late -- the client would be built with no URL and every query would fail with
 * `PrismaClientInitializationError`. Vitest runs setup files before the test
 * module graph is loaded, which is the only window that works.
 *
 * Real environment variables always win. CI exports its own, and this exists so a
 * developer with Postgres running does not have to duplicate the connection string
 * in their shell.
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(__dirname, "..", "..", ".env");

if (!process.env.DATABASE_URL?.trim() && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const match = /^\s*(DATABASE_URL(?:_UNPOOLED)?)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    // `.env` files commonly quote URLs because they contain `?` and `&`.
    const value = match[2].replace(/^["']|["']$/g, "").trim();
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}
