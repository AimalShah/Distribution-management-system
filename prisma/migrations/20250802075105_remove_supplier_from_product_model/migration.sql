/*
  Warnings:

  - You are about to drop the column `supplierId` on the `products` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."products" DROP CONSTRAINT "products_supplierId_fkey";

-- AlterTable
ALTER TABLE "public"."products" DROP COLUMN "supplierId";
