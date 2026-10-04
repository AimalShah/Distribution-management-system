-- better-auth's organization plugin (checkpoint 3) writes `createdAt` on every
-- invitation. The default backfills rows that predate it.
ALTER TABLE "invitation" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
