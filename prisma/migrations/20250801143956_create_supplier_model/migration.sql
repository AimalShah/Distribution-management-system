/*
  Warnings:

  - You are about to drop the `suppliers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."suppliers";

-- CreateTable
CREATE TABLE "public"."supplier" (
    "id" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_supplierCode_key" ON "public"."supplier"("supplierCode");
