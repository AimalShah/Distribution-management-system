import fs from "node:fs";
import path from "node:path";

/**
 * Read one dotenv-style file into `process.env`, first writer wins.
 *
 * The parse is deliberately as small as `checkpoints/support/load-env.ts`'s:
 * `dotenv` is not a workspace dependency, and the two files have to agree on
 * what counts as a value (quotes stripped, empty ignored) so a variable does
 * not resolve differently in a test than it does in `pnpm dev`.
 */
function load(file: string): void {
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);

    if (!match) continue;

    const value = match[2].replace(/^["']|["']$/g, "").trim();

    if (value && process.env[match[1]] === undefined) {
      process.env[match[1]] = value;
    }
  }
}

/**
 * Walk up from `start` to the workspace root, or give up at the filesystem
 * boundary. A marker rather than a fixed number of `..`s because `pnpm dev`
 * runs this with `cwd` set to `apps/server` while a built `dist/index.js` may
 * be started from the repository root, and both have to find the same file.
 */
function workspaceRoot(start: string): string | undefined {
  for (let dir = start; ; ) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;

    const parent = path.dirname(dir);

    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Populate `DATABASE_URL` and the development tenant before anything queries.
 *
 * Imported for its side effect, and deliberately the *first* import in
 * `index.ts`, because ordering is the whole mechanism: an import is evaluated
 * before the importer's body, so this runs before `./app` pulls in `@dms/db`.
 * Calling it from `index.ts` after those imports would already be too late.
 *
 * Two files, outermost first so the nearer one wins:
 *
 *   - the repository root `.env`, which is where `.env.example` says the local
 *     `DATABASE_URL` lives and which the parity suite already reads;
 *   - `apps/server/.env`, for values only this process may see. The dev
 *     organization id belongs there rather than at the root for the reason
 *     written on that file.
 *
 * A real environment variable beats both, which is how CI overrides the
 * connection string without editing anything on disk.
 *
 * Not reached from `app.ts`: the route suites import `./app` and assert the
 * `ORGANIZATION_REQUIRED` path, so the development tenant has to stay
 * invisible to them. `index.ts` is the process entry and the only importer.
 */
const root = workspaceRoot(process.cwd());

if (root) {
  load(path.join(root, ".env"));
  load(path.join(root, "apps", "server", ".env"));
}
