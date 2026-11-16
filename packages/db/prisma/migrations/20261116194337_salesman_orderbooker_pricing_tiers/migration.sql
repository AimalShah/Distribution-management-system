-- AlterTable products: add retailPrice and wholesalePrice defaulting from unitPrice
ALTER TABLE "products" ADD COLUMN "retailPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "wholesalePrice" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "products" SET "retailPrice" = "unitPrice", "wholesalePrice" = "unitPrice" WHERE "retailPrice" = 0 AND "wholesalePrice" = 0;

-- AlterTable sales: add salesmanId, orderBookerId, pricingTier
ALTER TABLE "sales" ADD COLUMN "orderBookerId" TEXT,
ADD COLUMN "pricingTier" TEXT NOT NULL DEFAULT 'retail',
ADD COLUMN "salesmanId" TEXT;

UPDATE "sales" SET "salesmanId" = "createdById" WHERE "salesmanId" IS NULL AND "createdById" IS NOT NULL;

-- CreateTable order_bookers
CREATE TABLE "order_bookers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_bookers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_bookers_organizationId_isActive_idx" ON "order_bookers"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "order_bookers_organizationId_code_key" ON "order_bookers"("organizationId", "code");

-- CreateIndex
CREATE INDEX "sales_salesmanId_idx" ON "sales"("salesmanId");

-- CreateIndex
CREATE INDEX "sales_orderBookerId_idx" ON "sales"("orderBookerId");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_orderBookerId_fkey" FOREIGN KEY ("orderBookerId") REFERENCES "order_bookers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bookers" ADD CONSTRAINT "order_bookers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
