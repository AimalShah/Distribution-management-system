-- CreateIndex
CREATE INDEX IF NOT EXISTS "supplier_organizationId_companyName_idx" ON "supplier"("organizationId", "companyName");
CREATE INDEX IF NOT EXISTS "supplier_organizationId_isActive_idx" ON "supplier"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customer_organizationId_name_idx" ON "customer"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "customer_organizationId_isActive_idx" ON "customer"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_organizationId_name_idx" ON "products"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "products_organizationId_categoryId_idx" ON "products"("organizationId", "categoryId");
CREATE INDEX IF NOT EXISTS "products_organizationId_brandId_idx" ON "products"("organizationId", "brandId");
CREATE INDEX IF NOT EXISTS "products_organizationId_isActive_idx" ON "products"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchases_organizationId_purchaseDate_idx" ON "purchases"("organizationId", "purchaseDate" DESC);
CREATE INDEX IF NOT EXISTS "purchases_organizationId_status_idx" ON "purchases"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_items_purchaseId_idx" ON "purchase_items"("purchaseId");
CREATE INDEX IF NOT EXISTS "purchase_items_productId_idx" ON "purchase_items"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_organizationId_saleDate_idx" ON "sales"("organizationId", "saleDate" DESC);
CREATE INDEX IF NOT EXISTS "sales_organizationId_status_idx" ON "sales"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sale_items_saleId_idx" ON "sale_items"("saleId");
CREATE INDEX IF NOT EXISTS "sale_items_productId_idx" ON "sale_items"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inventory_organizationId_quantityOnHand_idx" ON "inventory"("organizationId", "quantityOnHand");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "returns_organizationId_returnDate_idx" ON "returns"("organizationId", "returnDate" DESC);
CREATE INDEX IF NOT EXISTS "returns_organizationId_returnType_idx" ON "returns"("organizationId", "returnType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "return_items_returnId_idx" ON "return_items"("returnId");
CREATE INDEX IF NOT EXISTS "return_items_productId_idx" ON "return_items"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_organizationId_paidAt_idx" ON "payments"("organizationId", "paidAt" DESC);
CREATE INDEX IF NOT EXISTS "payments_organizationId_customerId_idx" ON "payments"("organizationId", "customerId");
