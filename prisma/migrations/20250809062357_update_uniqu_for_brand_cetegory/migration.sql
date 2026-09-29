/*
  Warnings:

  - A unique constraint covering the columns `[name,organizationId]` on the table `brand` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,organizationId]` on the table `category` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."brand_name_key";

-- DropIndex
DROP INDEX "public"."category_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "brand_name_organizationId_key" ON "public"."brand"("name", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "category_name_organizationId_key" ON "public"."category"("name", "organizationId");
