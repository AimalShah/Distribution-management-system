/*
  Warnings:

  - Made the column `totalCost` on table `purchase_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `unitCost` on table `purchase_items` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."purchase_items" ALTER COLUMN "totalCost" SET NOT NULL,
ALTER COLUMN "unitCost" SET NOT NULL;
