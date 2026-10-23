/**
 * Prepare the LOCAL QA test database: migrate, then remove residue from
 * earlier failed QA runs so unique constraints cannot collide.
 *
 * SAFETY NOTES
 * 1. The P0-7 local-host guard refuses anything but localhost before any
 *    connection is made.
 * 2. The Prisma CLI loads .env from the schema directory and OVERRIDES shell
 *    env with it — the developer .env points at Neon. Migrations therefore run
 *    against a schema copy placed OUTSIDE any .env directory, so the explicit
 *    local URL cannot be silently repointed at a remote host. verify the
 *    Datasource line says the local host or blow up.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const DB_PKG = path.join(REPO, "packages", "db");

const url =
  process.env.QA_TEST_DATABASE_URL?.trim().replace(/^["']|["']$/g, "") ||
  process.env.DATABASE_URL?.trim() ||
  "postgresql://medusa_db:pass1234@localhost:5432/dms_qa_test";

const host = new URL(url).hostname;

const { isLocalDatabase } = await import(path.join(DB_PKG, "prisma", "db-target.ts"));

process.env.DATABASE_URL = url;
// Forced, not `||=`: load-env (via db-target) may already have planted the
// developer's .env UNPOOLED value, and migrate deploy runs against
// directUrl — a seeded `||=` would silently point the migration at Neon.
process.env.DATABASE_URL_UNPOOLED = url;

// Same judgement the destructive seed/wipe scripts make (P0-7): if this is not
// a local host, the script dies here and nowhere else is touched.
if (!isLocalDatabase()) {
  console.error(
    `refusing: ${url} is not a local database host. Run qa-suite DB setup with a localhost URL.`
  );
  process.exit(1);
}

// 1. Migrate — using a schema copy OUTSIDE the .env directories so the CLI
//    cannot override DATABASE_URL from the developer's .env (Neon).
const schemaDir = path.join(process.env.TMPDIR ?? "/tmp", "opencode", "qa-schema");
fs.rmSync(schemaDir, { recursive: true, force: true });
fs.mkdirSync(path.join(schemaDir, "prisma", "migrations"), { recursive: true });
fs.copyFileSync(path.join(DB_PKG, "prisma", "schema.prisma"), path.join(schemaDir, "prisma", "schema.prisma"));
fs.cpSync(path.join(DB_PKG, "prisma", "migrations"), path.join(schemaDir, "prisma", "migrations"), { recursive: true });

// Run the CLI binary directly: `npx` from a parent context has been observed
// to pick up npm-provided env from the repo and silently re-point DATABASE_URL
// at the developer's .env host. `node <cli.js>` does not do this.
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js", { paths: [DB_PKG] });

const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", path.join(schemaDir, "prisma", "schema.prisma")], {
  encoding: "utf8",
  env: process.env,
  cwd: schemaDir,
});

const migrateOut = `${migrated.stdout ?? ""}${migrated.stderr ?? ""}`;

if (migrated.status !== 0) {
  console.error(migrateOut);
  process.exit(1);
}

if (!migrateOut.includes(host)) {
  console.error(migrateOut.slice(0, 2000));
  console.error(`refusing to continue: prisma did not connect to ${host}`);
  process.exit(1);
}

console.log("migrations: applied");

// 2. Clear residue (leaf-to-root, scoped to QA-seeded tenants only)
const { default: prisma } = await import(path.join(REPO, "packages", "db", "src", "index.ts"));

const qaOrgs = await prisma.organization.findMany({
  // "QA Org *" comes from `seedTenant`; "probe *" from ad-hoc probe scripts.
  // Both are QA-only conventions — the guard above already refused anything
  // but the local test database.
  where: { OR: [{ name: { contains: "QA Org" } }, { name: { startsWith: "probe " } }] },
  select: { id: true },
});
console.log(`removing ${qaOrgs.length} stale QA tenant(s)`);

for (const { id } of qaOrgs) {
  await prisma.payment.deleteMany({ where: { organizationId: id } });
  await prisma.returnItem.deleteMany({ where: { return: { organizationId: id } } });
  await prisma.return.deleteMany({ where: { organizationId: id } });
  await prisma.saleItem.deleteMany({ where: { sale: { organizationId: id } } });
  await prisma.sale.deleteMany({ where: { organizationId: id } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { organizationId: id } } });
  await prisma.purchase.deleteMany({ where: { organizationId: id } });
  await prisma.inventoryLog.deleteMany({ where: { product: { organizationId: id } } });
  await prisma.stockBatch.deleteMany({ where: { organizationId: id } });
  await prisma.inventory.deleteMany({ where: { organizationId: id } });
  await prisma.role.deleteMany({ where: { organizationId: id } });
  await prisma.product.deleteMany({ where: { organizationId: id } });
  await prisma.brand.deleteMany({ where: { organizationId: id } });
  await prisma.category.deleteMany({ where: { organizationId: id } });
  await prisma.customer.deleteMany({ where: { organizationId: id } });
  await prisma.supplier.deleteMany({ where: { organizationId: id } });
  await prisma.member.deleteMany({ where: { organizationId: id } });
  await prisma.organization.deleteMany({ where: { id } });
}

// Leftover users from crashed runs (memberships already gone above)
const deadUsers = await prisma.user.findMany({
  where: {
    members: { none: {} },
    email: { contains: "@example.test" },
    inventoryLogs: { none: {} },
    returns: { none: {} },
    payments: { none: {} },
  },
  select: { id: true },
});
if (deadUsers.length > 0) {
  for (const user of deadUsers) await prisma.user.delete({ where: { id: user.id } });
  console.log(`removing ${deadUsers.length} stale QA user(s)`);
}

await prisma.$disconnect();
console.log("qa db ready");
