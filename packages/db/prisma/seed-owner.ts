// prisma/seed-owner.ts
// Seeds only the organization and owner credentials for initial setup.
import "./load-env";
import prisma from "../src/client";
import { hashPassword } from "better-auth/crypto";

export const DEFAULT_ORGANIZATION_ID = "XvLM6ho7gz20skKWktQkeDgYD4uGC9jE";
export const DEFAULT_OWNER_ID = "JEXqru5KeZxSMUhEQ1I6P5hJgMepXMum";
export const DEFAULT_OWNER_EMAIL = "owner@test.com";

export async function seedOwnerOnly() {
  console.log("🌱 Starting owner credentials seeding...");

  // 1. Get or Create Organization
  let organization = await prisma.organization.findFirst({
    where: { id: DEFAULT_ORGANIZATION_ID },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        id: DEFAULT_ORGANIZATION_ID,
        name: "Acme Distribution",
        slug: "acme",
        createdAt: new Date(),
      },
    });
    console.log(`✅ Organization created: ${organization.name} (${organization.id})`);
  } else {
    console.log(`ℹ️  Organization exists: ${organization.name} (${organization.id})`);
  }

  // 2. Get or Create Owner user
  let owner = await prisma.user.findFirst({
    where: { email: DEFAULT_OWNER_EMAIL },
  });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        id: DEFAULT_OWNER_ID,
        name: "Test Owner",
        email: DEFAULT_OWNER_EMAIL,
        emailVerified: true,
        organizationId: organization.id,
        isOwner: true,
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Owner user created: ${owner.name} (${owner.email})`);
  } else {
    console.log(`ℹ️  Owner user exists: ${owner.name} (${owner.email})`);
  }

  // 3. Ensure owner is an organization member
  let ownerMember = await prisma.member.findFirst({
    where: { userId: owner.id, organizationId: organization.id },
  });

  if (!ownerMember) {
    ownerMember = await prisma.member.create({
      data: {
        id: `member_${owner.id}`,
        organizationId: organization.id,
        userId: owner.id,
        role: "owner",
        createdAt: new Date(),
      },
    });
    console.log(`✅ Organization membership created for owner (role: owner)`);
  } else {
    console.log(`ℹ️  Organization membership exists`);
  }

  // 4. Ensure owner credential account exists for Better-Auth password authentication
  const ownerPassword = process.env.DMS_OWNER_PASSWORD?.trim() || "admin123";

  let ownerCredential = await prisma.account.findFirst({
    where: { userId: owner.id, providerId: "credential" },
  });

  if (!ownerCredential) {
    ownerCredential = await prisma.account.create({
      data: {
        id: `account_${owner.id}`,
        accountId: owner.id,
        providerId: "credential",
        userId: owner.id,
        password: await hashPassword(ownerPassword),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Owner credential account created`);
  } else {
    console.log(`ℹ️  Owner credential account exists`);
  }

  console.log("\n🎉 Owner credentials seeding completed successfully!");
  console.log(`   Organization ID : ${organization.id}`);
  console.log(`   Owner User ID   : ${owner.id}`);
  console.log(`   Owner Email     : ${owner.email}`);
  console.log(`   Password        : ${ownerPassword}`);
  console.log(`   Role            : ${owner.role}`);

  return { organization, owner, ownerMember, ownerCredential };
}

seedOwnerOnly()
  .catch((e) => {
    console.error("❌ Error during owner seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("🔌 Database connection closed");
  });
