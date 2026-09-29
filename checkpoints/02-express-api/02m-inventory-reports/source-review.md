# Checkpoint 2m — Inventory Reports API: Source Review

## Source Review: `src/actions/reports/inventoryReport.ts` + `src/services/reports/inventoryReport.ts`

### Exported Functions

#### `fetchBasicInventoryReport(startDate, endDate)`
- **Input:** Date range
- **Returns:** Inventory report with movement sums (IN, OUT, ADJUSTMENT, etc.)

#### `fetchInventoryMovements(startDate, endDate)`
- **Input:** Date range
- **Returns:** Raw movement log entries

#### `fetchLowStockReport(startDate, endDate)`
- **Input:** Date range
- **Returns:** Low stock items with supplier info

#### `fetchStockValuationReport(startDate, endDate)`
- **Input:** Date range
- **Returns:** Stock valuation (quantity × cost)

#### `fetchExpiryReport(startDate, endDate, daysUntilExpiry?)`
- **Input:** Date range + optional days until expiry threshold
- **Returns:** Expiry tracking with batch info

#### `fetchFullInventoryReports(params)`
- **Input:** All report params
- **Returns:** All inventory reports combined

### Service Layer

- `getBasicInventoryReport(startDate, endDate)` — inventory report with movement sums
- `getStockValuationReport(startDate, endDate)` — stock valuation
- `getInventoryMovements(startDate, endDate)` — raw movement log entries
- `getLowStockReport(startDate, endDate)` — low stock with supplier info
- `getExpiryReport(startDate, endDate, daysUntilExpiry?)` — expiry tracking

### Bugs/Assumptions

1. `getExpiryReport` and `getLowStockReport` are listed in the gap analysis as "currently missing" — they exist in the service layer but may not be fully wired
2. Reports use date range filtering but no org scoping in some functions
