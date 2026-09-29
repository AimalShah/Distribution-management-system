# Checkpoint 2d — Inventory API: Source Review

## Source Review: `src/actions/inventory.ts` + `src/services/inventory.ts`

### Exported Functions

#### `createInventoryAction(data)`
- **Input:** Inventory data (productId, quantityOnHand, reorderLevel, maxStockLevel)
- **Side effects:** Creates inventory record
- **Returns:** Created inventory

#### `fetchInventory()`
- **Input:** None (uses session org ID)
- **Returns:** Array of inventory with product + logs relations
- **Note:** Unpaginated

#### `fetchInventoryLogsAction(productId?: string)`
- **Input:** Optional product ID filter
- **Returns:** Array of inventory logs with product + user relations

#### `adjustInventoryAction(data)`
- **Input:** Adjustment data (inventoryId, movementType, quantity, reason)
- **Side effects:**
  - Updates inventory quantity
  - Creates InventoryLog entry
- **Returns:** Updated inventory

#### `fetchLowStockProductsAction()`
- **Input:** None
- **Returns:** Products below reorder level

#### `updateInventorySettingsAction(data)`
- **Input:** Settings (reorderLevel, maxStockLevel, quantityReserved)
- **Side effects:** Updates inventory settings
- **Returns:** Updated inventory

### Service Layer

- `addInventory(data)` — creates inventory record
- `getInventory(orgId)` — fetches with product + logs
- `fetchInventoryLogs(orgId, productId?)` — fetches logs with product + user
- `adjustInventoryQuantity(data)` — adjusts quantity + creates log
- `fetchLowStockProducts(orgId)` — fetches products below reorder level
- `updateInventorySettings(data)` — updates reorder/max/reserved levels

### Bugs/Assumptions

1. `adjustInventoryQuantity` doesn't validate stock availability — could go negative
2. No transaction on adjust — partial failure could leave inconsistent state
3. `fetchLowStockProducts` returns full product objects, not just inventory items
