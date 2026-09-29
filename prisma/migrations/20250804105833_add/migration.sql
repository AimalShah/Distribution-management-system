/*
  Warnings:

  - You are about to drop the column `totalPrice` on the `purchase_items` table. All the data in the column will be lost.
  - You are about to drop the column `unitPrice` on the `purchase_items` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."InventoryMovement" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'RETURN', 'DAMAGED', 'EXPIRED');

-- AlterTable
ALTER TABLE "public"."purchase_items" DROP COLUMN "totalPrice",
DROP COLUMN "unitPrice",
ADD COLUMN     "totalCost" DOUBLE PRECISION,
ADD COLUMN     "unitCost" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "public"."inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "quantityReserved" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "maxStockLevel" INTEGER,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_logs" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "movementType" "public"."InventoryMovement" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousQty" INTEGER NOT NULL,
    "newQty" INTEGER NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_productId_key" ON "public"."inventory"("productId");

-- CreateIndex
CREATE INDEX "inventory_productId_idx" ON "public"."inventory"("productId");

-- CreateIndex
CREATE INDEX "inventory_quantityOnHand_idx" ON "public"."inventory"("quantityOnHand");

-- CreateIndex
CREATE INDEX "inventory_logs_inventoryId_idx" ON "public"."inventory_logs"("inventoryId");

-- CreateIndex
CREATE INDEX "inventory_logs_productId_idx" ON "public"."inventory_logs"("productId");

-- CreateIndex
CREATE INDEX "inventory_logs_userId_idx" ON "public"."inventory_logs"("userId");

-- CreateIndex
CREATE INDEX "inventory_logs_createdAt_idx" ON "public"."inventory_logs"("createdAt");

-- CreateIndex
CREATE INDEX "inventory_logs_movementType_idx" ON "public"."inventory_logs"("movementType");

-- AddForeignKey
ALTER TABLE "public"."inventory" ADD CONSTRAINT "inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_logs" ADD CONSTRAINT "inventory_logs_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "public"."inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_logs" ADD CONSTRAINT "inventory_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_logs" ADD CONSTRAINT "inventory_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
