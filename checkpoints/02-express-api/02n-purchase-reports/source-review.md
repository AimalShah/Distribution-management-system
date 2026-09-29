# Checkpoint 2n — Purchase Reports API: Source Review

## Source Review: `src/actions/reports/purchaseReport.ts` + `src/services/reports/purchaseReport.ts`

### Exported Functions

#### `fetchBasicPurchaseReport(params)`
- **Input:** Date range params
- **Returns:** Total amount, orders, suppliers, items, daily totals

#### `fetchPurchaseBySupplier(params)`
- **Input:** Date range params
- **Returns:** Purchases grouped by supplier

#### `fetchPurchaseByProduct(params)`
- **Input:** Date range params
- **Returns:** Purchases grouped by product

#### `fetchFullPurchaseReport(params)`
- **Input:** All report params
- **Returns:** All purchase reports combined

### Service Layer

- `getBasicPurchaseReport(startDate, endDate)` — total amount, orders, suppliers, items, daily totals
- `getPurchaseBySupplier(startDate, endDate)` — purchases grouped by supplier
- `getPurchaseByProduct(startDate, endDate)` — purchases grouped by product
