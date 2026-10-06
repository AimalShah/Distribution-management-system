/**
 * Empty the database without leaving the API pointing at a tenant that no
 * longer exists.
 *
 * Truncating by hand is what broke `POST /api/categories`: every write carries
 * `organizationId`, so a database with no `organization` row answers
 * `FOREIGN_KEY_VIOLATION` and the Add Product form's "create category" button
 * fails. This script therefore deletes *everything* and then puts back the one
 * tenant `apps/server/.env` names -- business data goes, the room it is filed
 * in stays.
 *
 * Run with `pnpm db:wipe`. `pnpm db:seed` remains the way back to demo data.
 */
// First import: it fills `process.env` before the client below is built.
import "./load-env";

/** Same ids `seed.ts` creates and `apps/server/.env` reads. */
const ORGANIZATION_ID = "XvLM6ho7gz20skKWktQkeDgYD4uGC9jE";
const OWNER_ID = "JEXqru5KeZxSMUhEQ1I6P5hJgMepXMum";

/** Children before parents: every row below has a foreign key to one above. */
const wipeOrder = [
  "returnItem",
  "return",
  "saleItem",
  "sale",
  "purchaseItem",
  "purchase",
  "inventoryLog",
  "inventory",
  "product",
  "brand",
  "category",
  "customer",
  "supplier",
  "invitation",
  "verification",
  "session",
  "account",
  "member",
  "user",
  "organization",
] as const;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set and neither packages/db/.env nor the repo root .env defines it."
    );
  }

  const { default: prisma } = await import("../src/client");

  console.log("🗑️  Deleting all rows...");
  for (const model of wipeOrder) {
    const deleted = await prisma[model].deleteMany();
    if (deleted.count > 0) console.log(`   ${(model + " ").padEnd(16)} ${deleted.count}`);
  }

  const now = new Date();
  const organization = await prisma.organization.create({
    data: {
      id: ORGANIZATION_ID,
      name: "Acme Distribution",
      slug: "acme",
      createdAt: now,
    },
  });

  const owner = await prisma.user.create({
    data: {
      id: OWNER_ID,
      name: "Test Owner",
      email: "owner@test.com",
      emailVerified: true,
      organizationId: organization.id,
      isOwner: true,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.member.create({
    data: {
      id: `member_${owner.id}`,
      organizationId: organization.id,
      userId: owner.id,
      role: "owner",
      createdAt: now,
    },
  });

  console.log(`✅ Wiped. Tenant restored: ${organization.name} (${organization.id})`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
