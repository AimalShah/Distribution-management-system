# Checkpoint 4e — Inventory Page: Source Review

## Source Review: `src/app/(app)/inventory/page.tsx` + `src/components/inventory/*`

### Page: `src/app/(app)/inventory/page.tsx`

**Data fetched:**
- Inventory list (all inventory for current org)
- Inventory logs (for movement tab)

**Features:**
- Tabs: Inventory / Movement Logs
- Inventory tab: table with product, quantity, reorder level, max level
- Adjust inventory button
- Movement logs tab: table with movement type, product, quantity, reason, date

### Components

#### `InventoryTable.tsx`
- Table with columns: Product, Quantity on Hand, Reserved, Reorder Level, Max Level, Actions
- Adjust button opens dialog

#### `AddInventoryForm.tsx`
- Form to add new inventory record
- Fields: product, quantity, reorder level, max level
- **Note:** Listed in gap analysis as needing rebuild against real schema

#### `validations.ts`
- Zod schema for inventory form validation

### Bugs/Assumptions

1. Inventory list is not paginated
2. `AddInventoryForm` may not match the real schema (gap analysis finding)
3. No loading states
