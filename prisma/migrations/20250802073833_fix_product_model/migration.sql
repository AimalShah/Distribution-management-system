/*
  Warnings:

  - You are about to drop the column `costPrice` on the `products` table. All the data in the column will be lost.
  - Added the required column `unitCost` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."products" DROP COLUMN "costPrice",
ADD COLUMN     "unitCost" DECIMAL(65,30) NOT NULL;
