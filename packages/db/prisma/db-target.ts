// The one check every data-destroying script opens with.
//
// Each script below is safe on the developer's machine and catastrophic
// pointed at the production database: `db:wipe` truncates every table,
// `db:seed` replaces whole rows, `db:seed:owner` plants a fresh owner
// password, and `db:seed:stress` appends hundreds of thousands of rows. A
// shell history, a copied `.env`, or a stale terminal is all it takes to aim
// one at the wrong database — so each one refuses unless the target is
// demonstrably local, and the escape hatch names the host it is about to act
// on so the operator has to have read it.
import "./load-env";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const databaseHost = () => {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) return undefined; // `load-env` missing entirely is its own error.

  try {
    return new URL(url).hostname || null;
  } catch {
    return null; // Not parseable as a URL: treat as hostile until proven local.
  }
};

/**
 * True only when `DATABASE_URL` points at this machine. Shared with
 * `owner-password.ts`, which needs the same "may a known literal survive
 * here?" judgement; `assertLocalDatabase` needs it for its refusal.
 * `undefined` (no URL at all) and unparseable URL strings both read as
 * non-local — the caller's job to report with context.
 */
export function isLocalDatabase(): boolean {
  const host = databaseHost();

  return host != null && LOCAL_HOSTS.has(host);
}

/**
 * Abort unless `DATABASE_URL` points at this machine. `DMS_ALLOW_DESTRUCTIVE=true`
 * overrides for a deliberate run against a remote database — the override is
 * never silent: it echoes the host so an operator who types it has seen where
 * the damage goes.
 */
export function assertLocalDatabase(script: string): void {
  const host = databaseHost();

  if (isLocalDatabase()) return;

  if (process.env.DMS_ALLOW_DESTRUCTIVE?.trim().toLowerCase() === "true") {
    console.warn(
      `⚠️  ${script}: DMS_ALLOW_DESTRUCTIVE=true is set — running against "${host ?? "unknown host"}". ` +
        "Every row reachable via DATABASE_URL is about to change."
    );

    return;
  }

  throw new Error(
    script +
      " is a destructive script and the database is not on this machine" +
      (host === null ? " (DATABASE_URL is not a parseable URL)" : ` (host: "${host ?? "unset"}")`) +
      '. If you really mean it, set DMS_ALLOW_DESTRUCTIVE="true"'
  );
}
