-- AlterTable
ALTER TABLE "brand" ADD COLUMN     "shortCode" TEXT;

-- AlterTable
ALTER TABLE "category" ADD COLUMN     "shortCode" TEXT;

-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "creditTermDays" INTEGER;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "dueDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "skuFormat" TEXT NOT NULL DEFAULT '{BRAND}-{CATEGORY}-{SEQ:5}',
    "skuSeparator" TEXT NOT NULL DEFAULT '-',
    "skuSequence" INTEGER NOT NULL DEFAULT 0,
    "returnWindowDays" INTEGER NOT NULL DEFAULT 30,
    "returnsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "creditTermDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_organizationId_key" ON "company_settings"("organizationId");

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
