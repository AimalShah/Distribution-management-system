# Checkpoint 4d — Sale Invoice Pages: Plan

## Goal

Port sale invoice list and new sale invoice pages to React + Vite.

## Implementation

### Route: `apps/web/src/pages/SaleInvoiceList.tsx`

Server-side paginated table. Columns: Code, Customer, Date, Status, Total, Actions (view, print, PDF).

### Route: `apps/web/src/pages/SaleInvoiceNew.tsx`

Port `SaleInvoiceForm` with:
- Customer select
- Dynamic item rows with product select
- Auto-calculated totals
- Zod validation

### Invoice PDF

PDF generation moves to server-side:
- `GET /api/sales/:id/pdf` — generates PDF on server using Puppeteer
- `GET /api/sales/:id/print` — returns printable HTML

## Intentional Deviations

1. **Server-side pagination** — was client-side
2. **PDF generation** — moves from client-side Puppeteer to server-side
3. **React Query** — replaces SWR
