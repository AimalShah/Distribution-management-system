/*
  Warnings:

  - You are about to drop the column `ownerId` on the `organization` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."organization" DROP CONSTRAINT "organization_ownerId_fkey";

-- AlterTable
ALTER TABLE "public"."organization" DROP COLUMN "ownerId";
