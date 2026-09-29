/*
  Warnings:

  - A unique constraint covering the columns `[name,categoryId,organizationId]` on the table `brand` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `categoryId` to the `brand` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."brand_name_organizationId_key";

-- AlterTable
ALTER TABLE "public"."brand" ADD COLUMN     "categoryId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "brand_name_categoryId_organizationId_key" ON "public"."brand"("name", "categoryId", "organizationId");

-- AddForeignKey
ALTER TABLE "public"."brand" ADD CONSTRAINT "brand_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
