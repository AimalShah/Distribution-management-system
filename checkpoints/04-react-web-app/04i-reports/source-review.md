# Checkpoint 4i — Reports Page: Source Review

## Source Review: `src/app/(app)/reports/page.tsx` + `src/components/reports/*`

### Page: `src/app/(app)/reports/page.tsx`

**Data fetched:**
- Sales reports (basic, by customer, by product)
- Purchase reports (basic, by supplier, by product)
- Inventory reports (basic, movements, low stock, stock valuation, expiry)

**Components used:**
- `ReportClient` — client-side report container
- `SalesReport`, `PurchaseReport`, `InventoryReport` — report components
- Various chart components (Recharts)

**Features:**
- Date range picker
- Report type tabs
- Charts and tables for each report type
- Export functionality (if any)

### Components

#### `ReportClient.tsx`
- Container component with date range picker and report type tabs
- Fetches report data based on selected type and date range

#### Sales reports:
- `SalesReport.tsx` — basic sales table
- `SalesByCustomer.tsx` — sales grouped by customer
- `SalesByProduct.tsx` — sales grouped by product
- `SalesLineChart.tsx` — sales over time chart

#### Purchase reports:
- `PurchaseReport.tsx` — basic purchase table
- `PurchaseBySupplier.tsx` — purchases by supplier
- `PurchaseByProduct.tsx` — purchases by product
- `PurchaseLineChart.tsx` — purchases over time

#### Inventory reports:
- `InventoryReport.tsx` — basic inventory table
- `InventoryMovementReport.tsx` — movement log
- `StockValuationReport.tsx` — stock valuation
- `LowStockAlert.tsx` — low stock items

### Bugs/Assumptions

1. All reports fetched client-side with SWR
2. Date range defaults to current month
3. Charts use Recharts
