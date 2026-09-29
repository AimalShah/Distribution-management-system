# Checkpoint 4f — Returns Pages: Plan

## Goal

Port returns list and new return pages to React + Vite.

## Implementation

### Route: `apps/web/src/pages/ReturnList.tsx`

Server-side paginated table. Columns: Code, Type, Date, Reason, Actions.

### Route: `apps/web/src/pages/ReturnNew.tsx`

Port `ReturnForm` with:
- Return type select
- Conditional saleId/purchaseId fields
- Dynamic item rows
- Zod validation (SALE requires saleId, PURCHASE requires purchaseId)

## Intentional Deviations

1. **Server-side pagination** — was client-side
2. **React Query** — replaces SWR
3. **Loading states** — added
