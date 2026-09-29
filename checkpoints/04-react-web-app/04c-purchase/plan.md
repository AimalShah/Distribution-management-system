# Checkpoint 4c — Purchase Pages: Plan

## Goal

Port purchase list and new purchase pages to React + Vite.

## Implementation

### Route: `apps/web/src/pages/PurchaseList.tsx`

Server-side paginated table using DataTable. Columns: Code, Supplier, Date, Status, Total, Actions.

### Route: `apps/web/src/pages/PurchaseNew.tsx`

Port `PurchaseForm` with:
- Supplier select (from API)
- Dynamic item rows with product select
- Date picker for purchase date and expiry dates
- Auto-calculated totals
- Zod validation

## Intentional Deviations

1. **Server-side pagination** — was client-side
2. **React Query** — replaces SWR
3. **Loading states** — added
