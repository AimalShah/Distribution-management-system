-- AlterTable
ALTER TABLE "public"."organization" ADD COLUMN     "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."organization" ADD CONSTRAINT "organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
