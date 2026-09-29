# Checkpoint 2c — Sale Invoice API: Source Review

## Source Review: `src/actions/saleInvoice.ts` + `src/services/saleInvoice.ts`

### Exported Functions

#### `createSaleInvoice(data: SaleInvoiceFormData)`
- **Input:** SaleInvoiceFormData (saleCode, customerId, taxAmount?, discount?, status, saleItems[])
- **Validation:** SaleInvoiceSchema (Zod)
- **Side effects:**
  - Creates Sale record
  - Creates SaleItem records
  - Updates Inventory (OUT movement) for each item
  - Creates InventoryLog entries
- **Returns:** Created sale with items and customer

#### `fetchSalesInvoices()`
- **Input:** None (uses session org ID)
- **Returns:** Array of sales with customer + items
- **Note:** Unpaginated

#### `getSalesInvoicesByCustomer(customerId: string)`
- **Input:** Customer ID
- **Returns:** Sales for that customer

#### `editSaleInvoice(id: string, data: Partial<SaleInvoiceFormData>)`
- **Input:** Sale ID + partial data
- **Side effects:** Updates sale record
- **Returns:** Updated sale

#### `removeSaleInvoice(id: string)`
- **Input:** Sale ID
- **Side effects:** Deletes sale record
- **Returns:** Deleted sale

### Service Layer

- `addSaleInvoice(data, orgId, userId)` — creates sale + items + inventory deduction
- `getSaleInvoices(orgId)` — fetches with customer + items
- `getSaleInvoiceDetail(saleCode)` — fetches single sale by code
- `getSaleByCustomer(customerId)` — fetches sales by customer
- `updateSaleInvoice(id, data)` — updates sale
- `deleteSaleInvoice(id)` — deletes sale

### Bugs/Assumptions

1. Inventory deduction happens in service layer — needs transaction in Express
2. No stock availability check before deduction — could go negative
3. `getSaleInvoiceDetail` uses `saleCode` not `id` — Express should support both
