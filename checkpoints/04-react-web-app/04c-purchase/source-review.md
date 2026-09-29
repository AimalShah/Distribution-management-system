# Checkpoint 4c — Purchase Pages: Source Review

## Source Review: `src/app/(app)/purchase/page.tsx` + `src/app/(app)/purchase/new/page.tsx` + `src/components/PurchaseForm.tsx`

### Page: `src/app/(app)/purchase/page.tsx`

**Data fetched:**
- Purchases list (all purchases for current org)

**Features:**
- Table with purchase list
- Status badges (Pending/Completed/Cancelled)
- View/edit/delete actions

### Page: `src/app/(app)/purchase/new/page.tsx`

**Components used:**
- `PurchaseForm` — form with supplier select, items array, date picker

**Data fetched:**
- Suppliers (for dropdown)
- Products (for item rows)

### Components

#### `PurchaseForm.tsx`
- Form with: supplier select, purchase code, date, status, discount, tax
- Dynamic item rows: product select, quantity, unit cost, batch number, expiry date, tax %, discount
- Calculates totals
- Submit calls `createPurchase` or `editPurchase`

### Bugs/Assumptions

1. Purchase list is not paginated
2. No loading states on form submission
3. Item rows are dynamically added/removed
