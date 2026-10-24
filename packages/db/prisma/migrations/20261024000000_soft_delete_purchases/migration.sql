-- AlterTable
ALTER TABLE "purchases" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "purchases_organizationId_deletedAt_idx" ON "purchases"("organizationId", "deletedAt");
