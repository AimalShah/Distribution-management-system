# Checkpoint 7 — Batch/Lot Inventory + Expiry KPI: Plan

## Goal

Add `StockBatch` model for batch/lot tracking, implement the currently-missing `getExpiryReport`/`getLowStockReport`, and add an "Expiring Soon" dashboard card.

## Current State

- `PurchaseItem` has `batchNumber` and `expiryDate` fields but no dedicated batch model
- `Inventory` tracks aggregate quantity per product (no batch-level tracking)
- `getExpiryReport` and `getLowStockReport` exist in the service layer but may not be fully wired
- Dashboard has no "Expiring Soon" card

## Schema Changes

### New Prisma Model

```prisma
model StockBatch {
  id                String   @id @default(cuid())
  productId         String
  organizationId    String
  batchNumber       String
  expiryDate        DateTime?
  quantityRemaining Int      @default(0)
  quantityReceived  Int      @default(0)
  unitCost          Float    @default(0)
  purchaseItemId    String?
  receivedAt        DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  product           Product  @relation(fields: [productId], references: [id])
  organization      Organization @relation(fields: [organizationId], references: [id])
  purchaseItem      PurchaseItem? @relation(fields: [purchaseItemId], references: [id])

  @@unique([productId, batchNumber, organizationId])
}
```

### Modified Models

- `Inventory` — add `batches StockBatch[]` relation
- `SaleItem` — add `batchId String?` and `batch StockBatch?` relation for batch-level deduction

## Implementation Steps

### 1. Schema migration
- Add `StockBatch` model
- Add `batchId` to `SaleItem`
- Create migration

### 2. Service layer updates
- `addPurchase` — create `StockBatch` records from purchase items with batch numbers
- `addSaleInvoice` — deduct from batches (FEFO — First Expired, First Out)
- `adjustInventory` — update batch quantities
- `getExpiryReport` — fully implement with batch-level data
- `getLowStockReport` — fully implement with batch-level data

### 3. Express endpoints
- `GET /api/inventory/batches` — list batches for current org
- `GET /api/inventory/batches/:id` — get single batch
- `GET /api/reports/inventory/expiry` — enhanced expiry report with batch data
- `GET /api/reports/inventory/low-stock` — enhanced low stock report

### 4. Dashboard "Expiring Soon" card
- New component `ExpiringSoonCard.tsx`
- Shows products with batches expiring within configurable days (default 30)
- Displays product name, batch number, expiry date, quantity remaining
- Link to inventory page with batch filter

### 5. React UI
- `apps/web/src/components/dashboard/ExpiringSoonCard.tsx`
- Add to dashboard page layout
- `apps/web/src/pages/inventory/Batches.tsx` — batch list view (new tab or page)

## Verification

- Purchase with batch numbers creates StockBatch records
- Sale deducts from batches using FEFO
- Expiry report shows batch-level data
- Low stock report shows batch-level data
- Dashboard "Expiring Soon" card renders correctly
- Batch list page shows all batches with filters
