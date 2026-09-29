# Checkpoint 2b — Purchase API: Source Review

## Source Review: `src/actions/purchase.ts` + `src/services/purchase.ts`

### Exported Functions

#### `createPurchase(data: PurchaseFormData)`
- **Input:** PurchaseFormData (supplierId, purchaseCode, purchaseDate, status, discount?, taxAmount?, items[])
- **Validation:** PurchaseFormSchema (Zod) — validates nested items array
- **Side effects:**
  - Creates Purchase record
  - Creates PurchaseItem records for each item
  - Updates Inventory (IN movement) for each item
  - Creates InventoryLog entries
- **Returns:** Created purchase with items and supplier

#### `fetchPurchases()`
- **Input:** None (uses session org ID)
- **Returns:** Array of purchases with supplier + items relations
- **Note:** Unpaginated

#### `fetchProduct(id: string)` — MISLEADING NAME
- **Input:** Purchase ID
- **Returns:** Single purchase with supplier + items
- **Note:** Function is named `fetchProduct` but actually fetches a purchase by ID

#### `editPurchase(id: string, data: Partial<PurchaseFormData>)`
- **Input:** Purchase ID + partial data
- **Side effects:** Updates purchase record
- **Returns:** Updated purchase

#### `removePurchase(id: string)`
- **Input:** Purchase ID
- **Side effects:** Deletes purchase record
- **Returns:** Deleted purchase

### Service Layer

- `addPurchase(data, orgId, userId)` — creates purchase + items + inventory updates in transaction
- `getPurchases(orgId)` — fetches with supplier + items
- `getPurchaseById(id)` — fetches single purchase
- `updatePurchase(id, data, orgId)` — updates purchase
- `deletePurchase(id, orgId)` — deletes purchase

### Bugs/Assumptions

1. `fetchProduct` name is misleading — should be `fetchPurchase` or `getPurchaseById`
2. Inventory updates happen in the service layer, not the action — the Express route needs to handle this atomically
3. No transaction wrapping on create — partial failure could leave inconsistent state
