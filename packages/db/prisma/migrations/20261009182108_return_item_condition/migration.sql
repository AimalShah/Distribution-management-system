-- CreateEnum
CREATE TYPE "ReturnCondition" AS ENUM ('RESTOCKABLE', 'DAMAGED');

-- AlterTable
ALTER TABLE "return_items" ADD COLUMN     "condition" "ReturnCondition" NOT NULL DEFAULT 'RESTOCKABLE',
ADD COLUMN     "reason" TEXT;
