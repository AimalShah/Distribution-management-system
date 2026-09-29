# Checkpoint 4f — Returns Pages: Source Review

## Source Review: `src/app/(app)/returns/page.tsx` + `src/app/(app)/returns/new/page.tsx` + `src/components/returns/ReturnForm.tsx`

### Page: `src/app/(app)/returns/page.tsx`

**Data fetched:**
- Returns list (all returns for current org)

**Features:**
- Table with returns list
- Type badges (SALE/PURCHASE/EXPIRED/DAMAGED)
- View/edit/delete actions

### Page: `src/app/(app)/returns/new/page.tsx`

**Components used:**
- `ReturnForm` — form with return type, items array

### Components

#### `ReturnForm.tsx`
- Form with: return code, return type (select), date, reason
- Conditional fields: saleId (for SALE returns), purchaseId (for PURCHASE returns)
- Dynamic item rows: product select, quantity, unit price, tax, discount, note
- Submit calls `createReturn` or `editReturn`

### Bugs/Assumptions

1. Returns list is not paginated
2. Conditional validation based on return type
3. No loading states
