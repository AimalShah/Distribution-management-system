/**
 * Read `.env` into `process.env` before `PrismaClient` is constructed.
 *
 * Only the Prisma CLI loads `.env` on its own. `tsx prisma/seed.ts` and
 * `tsx prisma/wipe.ts` do not, and neither does `new PrismaClient()` -- so both
 * scripts used to die with "Environment variable not found: DATABASE_URL" no
 * matter how the caller's shell looked. Importing this module first means the
 * file is read before the client module is evaluated, which is the only place
 * that still needs the variable.
 *
 * Real shell variables win: a caller who sets `DATABASE_URL` explicitly is
 * never overridden by what happens to be on disk.
 */
import fs from "node:fs";
import path from "node:path";

export function loadEnvFile(file: string): void {
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;

    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^(["'])(.*)\1$/, "$2");
  }
}

// packages/db/.env first, then the repo root, so a workspace-level override
// can fill in what the package file leaves out.
loadEnvFile(path.join(__dirname, "..", ".env"));
loadEnvFile(path.join(__dirname, "..", "..", "..", ".env"));
