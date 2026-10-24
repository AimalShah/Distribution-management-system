-- Store every monetary amount as decimal cents. Percentage rates and quantities
-- intentionally remain floating point / integer values as they describe terms,
-- not currency.
ALTER TABLE "customer"
    ALTER COLUMN "creditLimit" TYPE DECIMAL(12,2)
    USING CASE WHEN "creditLimit" IS NULL THEN NULL ELSE ROUND("creditLimit"::numeric, 2) END;

ALTER TABLE "products"
    ALTER COLUMN "unitPrice" TYPE DECIMAL(12,2) USING ROUND("unitPrice"::numeric, 2),
    ALTER COLUMN "unitCost" TYPE DECIMAL(12,2) USING ROUND("unitCost"::numeric, 2);

ALTER TABLE "purchases"
    ALTER COLUMN "totalAmount" TYPE DECIMAL(12,2) USING ROUND("totalAmount"::numeric, 2),
    ALTER COLUMN "taxAmount" TYPE DECIMAL(12,2) USING CASE WHEN "taxAmount" IS NULL THEN NULL ELSE ROUND("taxAmount"::numeric, 2) END,
    ALTER COLUMN "discount" TYPE DECIMAL(12,2) USING CASE WHEN "discount" IS NULL THEN NULL ELSE ROUND("discount"::numeric, 2) END;

ALTER TABLE "purchase_items"
    ALTER COLUMN "unitCost" TYPE DECIMAL(12,2) USING ROUND("unitCost"::numeric, 2),
    ALTER COLUMN "totalCost" TYPE DECIMAL(12,2) USING ROUND("totalCost"::numeric, 2),
    ALTER COLUMN "discount" TYPE DECIMAL(12,2) USING CASE WHEN "discount" IS NULL THEN NULL ELSE ROUND("discount"::numeric, 2) END;

ALTER TABLE "sales"
    ALTER COLUMN "totalAmount" TYPE DECIMAL(12,2) USING ROUND("totalAmount"::numeric, 2),
    ALTER COLUMN "taxAmount" TYPE DECIMAL(12,2) USING CASE WHEN "taxAmount" IS NULL THEN NULL ELSE ROUND("taxAmount"::numeric, 2) END,
    ALTER COLUMN "discount" TYPE DECIMAL(12,2) USING CASE WHEN "discount" IS NULL THEN NULL ELSE ROUND("discount"::numeric, 2) END,
    ALTER COLUMN "cgstAmount" TYPE DECIMAL(12,2) USING ROUND("cgstAmount"::numeric, 2),
    ALTER COLUMN "sgstAmount" TYPE DECIMAL(12,2) USING ROUND("sgstAmount"::numeric, 2),
    ALTER COLUMN "igstAmount" TYPE DECIMAL(12,2) USING ROUND("igstAmount"::numeric, 2),
    ALTER COLUMN "amountPaid" TYPE DECIMAL(12,2) USING ROUND("amountPaid"::numeric, 2);

ALTER TABLE "sale_items"
    ALTER COLUMN "unitPrice" TYPE DECIMAL(12,2) USING ROUND("unitPrice"::numeric, 2),
    ALTER COLUMN "totalPrice" TYPE DECIMAL(12,2) USING ROUND("totalPrice"::numeric, 2),
    ALTER COLUMN "discount" TYPE DECIMAL(12,2) USING CASE WHEN "discount" IS NULL THEN NULL ELSE ROUND("discount"::numeric, 2) END,
    ALTER COLUMN "cgstAmount" TYPE DECIMAL(12,2) USING ROUND("cgstAmount"::numeric, 2),
    ALTER COLUMN "sgstAmount" TYPE DECIMAL(12,2) USING ROUND("sgstAmount"::numeric, 2),
    ALTER COLUMN "igstAmount" TYPE DECIMAL(12,2) USING ROUND("igstAmount"::numeric, 2);

ALTER TABLE "return_items"
    ALTER COLUMN "taxAmount" TYPE DECIMAL(12,2) USING ROUND("taxAmount"::numeric, 2),
    ALTER COLUMN "discount" TYPE DECIMAL(12,2) USING ROUND("discount"::numeric, 2),
    ALTER COLUMN "unitPrice" TYPE DECIMAL(12,2) USING ROUND("unitPrice"::numeric, 2);

ALTER TABLE "payments"
    ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "stock_batches"
    ALTER COLUMN "unitCost" TYPE DECIMAL(12,2) USING ROUND("unitCost"::numeric, 2);
