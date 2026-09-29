-- DropForeignKey
ALTER TABLE "public"."user" DROP CONSTRAINT "user_organizationId_fkey";

-- AlterTable
ALTER TABLE "public"."user" ALTER COLUMN "organizationId" DROP NOT NULL;
