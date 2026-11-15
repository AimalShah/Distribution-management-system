-- Document attribution: who created a sale or purchase (GLOSSARY.md "Created by").
-- New rows get the session user at write time; the backfill below recovers the
-- historical creator from the inventory ledger, whose first movement per document
-- (`Stock Out from Sale <code>` / `Stock In from Purchase <code>`) was written by
-- the same user who created the document. Where no ledger row exists the column
-- stays null and the UI omits the line.

ALTER TABLE "purchases" ADD COLUMN "createdById" TEXT;
ALTER TABLE "sales" ADD COLUMN "createdById" TEXT;

CREATE INDEX "purchases_createdById_idx" ON "purchases"("createdById");
CREATE INDEX "sales_createdById_idx" ON "sales"("createdById");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill sales from the earliest stock-out written for its document code.
UPDATE "sales" s
SET "createdById" = ranked."userId"
FROM (
    SELECT i."reference" AS "code", p."organizationId" AS "orgId", i."userId",
           ROW_NUMBER() OVER (
               PARTITION BY i."reference", p."organizationId"
               ORDER BY i."createdAt" ASC
           ) AS rn
    FROM "inventory_logs" i
    JOIN "products" p ON p."id" = i."productId"
    WHERE i."reference" IS NOT NULL
      AND i."reason" LIKE 'Stock Out from Sale %'
) ranked
WHERE ranked."code" = s."saleCode"
  AND ranked."orgId" = s."organizationId"
  AND ranked.rn = 1
  AND s."createdById" IS NULL;

-- Backfill purchases from the earliest stock-in written for its document code.
UPDATE "purchases" pu
SET "createdById" = ranked."userId"
FROM (
    SELECT i."reference" AS "code", p."organizationId" AS "orgId", i."userId",
           ROW_NUMBER() OVER (
               PARTITION BY i."reference", p."organizationId"
               ORDER BY i."createdAt" ASC
           ) AS rn
    FROM "inventory_logs" i
    JOIN "products" p ON p."id" = i."productId"
    WHERE i."reference" IS NOT NULL
      AND i."reason" LIKE 'Stock In from Purchase %'
) ranked
WHERE ranked."code" = pu."purchaseCode"
  AND ranked."orgId" = pu."organizationId"
  AND ranked.rn = 1
  AND pu."createdById" IS NULL;
