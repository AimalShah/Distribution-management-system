# Checkpoint 2o — Sales Reports API: Source Review

## Source Review: `src/actions/reports/salesReport.ts` + `src/services/reports/salesReport.ts`

### Exported Functions

#### `fetchBasicSalesReport(params)`
- **Input:** Date range params
- **Returns:** Total sales, orders, customers, items, daily totals

#### `fetchSalesByCustomer(params)`
- **Input:** Date range params
- **Returns:** Sales grouped by customer

#### `fetchSalesByProduct(params)`
- **Input:** Date range params
- **Returns:** Sales grouped by product

#### `fetchFullSalesReport(params)`
- **Input:** All report params
- **Returns:** All sales reports combined

### Service Layer

- `getBasicSalesReport(startDate, endDate)` — total sales, orders, customers, items, daily totals
- `getSalesByCustomer(startDate, endDate)` — sales grouped by customer
- `getSalesByProduct(startDate, endDate)` — sales grouped by product
