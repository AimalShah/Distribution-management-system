/*
  Warnings:

  - You are about to drop the column `lastUpdated` on the `inventory` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `brand` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `inventory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `inventory_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `purchases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `returns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `sales` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."brand" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."category" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."inventory" DROP COLUMN "lastUpdated",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."inventory_logs" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."purchases" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."returns" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."sales" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
