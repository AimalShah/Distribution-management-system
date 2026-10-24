CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_sequences_organizationId_type_key"
    ON "document_sequences"("organizationId", "type");

ALTER TABLE "document_sequences"
    ADD CONSTRAINT "document_sequences_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve monotonic numbering when an existing tenant already has one of the
-- server's new code shapes. Legacy random codes remain valid and unchanged.
INSERT INTO "document_sequences" ("id", "organizationId", "type", "lastNumber")
SELECT 'seq_' || md5("organizationId" || ':sale-' || substring("saleCode" from '^SALE-([0-9]{4})-')),
       "organizationId",
       'sale-' || substring("saleCode" from '^SALE-([0-9]{4})-'),
       MAX(substring("saleCode" from '-([0-9]+)$')::INTEGER)
FROM "sales"
WHERE "saleCode" ~ '^SALE-[0-9]{4}-[0-9]+$'
GROUP BY "organizationId", substring("saleCode" from '^SALE-([0-9]{4})-');

INSERT INTO "document_sequences" ("id", "organizationId", "type", "lastNumber")
SELECT 'seq_' || md5("organizationId" || ':purchase'), "organizationId", 'purchase',
       MAX(substring("purchaseCode" from '([0-9]+)$')::INTEGER)
FROM "purchases"
WHERE "purchaseCode" ~ '^PO-[0-9]+$'
GROUP BY "organizationId";

INSERT INTO "document_sequences" ("id", "organizationId", "type", "lastNumber")
SELECT 'seq_' || md5("organizationId" || ':return'), "organizationId", 'return',
       MAX(substring("returnCode" from '([0-9]+)$')::INTEGER)
FROM "returns"
WHERE "returnCode" ~ '^RET-[0-9]+$'
GROUP BY "organizationId";

INSERT INTO "document_sequences" ("id", "organizationId", "type", "lastNumber")
SELECT 'seq_' || md5("organizationId" || ':payment'), "organizationId", 'payment',
       MAX(substring("paymentCode" from '([0-9]+)$')::INTEGER)
FROM "payments"
WHERE "paymentCode" ~ '^PMT-[0-9]+$'
GROUP BY "organizationId";

DROP INDEX "sales_saleCode_key";
DROP INDEX "purchases_purchaseCode_key";
DROP INDEX "returns_returnCode_key";
DROP INDEX "payments_paymentCode_key";

CREATE UNIQUE INDEX "sales_organizationId_saleCode_key"
    ON "sales"("organizationId", "saleCode");
CREATE UNIQUE INDEX "purchases_organizationId_purchaseCode_key"
    ON "purchases"("organizationId", "purchaseCode");
CREATE UNIQUE INDEX "returns_organizationId_returnCode_key"
    ON "returns"("organizationId", "returnCode");
CREATE UNIQUE INDEX "payments_organizationId_paymentCode_key"
    ON "payments"("organizationId", "paymentCode");
