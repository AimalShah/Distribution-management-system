# Implementation Plan: Dashboard UX, Company Management & Document PDF Suite

## Overview
Transform the Distribution Management System from a clunky, reload-heavy interface into a snappy operational cockpit. This plan addresses three acute friction points:
1. **Company Switching & Editing**: Replace disruptive full-page reloads (`window.location.reload()`) with seamless in-place tenant switching, and add a direct "Edit Company Details" modal to update legal details, GSTIN, and address in place.
2. **Customer Statement & Document PDF Suite**: Implement server-side monochrome A4 PDF generation (matching ADR 0002) for Customer Statements (`GET /api/customers/:id/statement/pdf`), followed by Purchase Orders, Payment Receipts, and Return Credit Notes.
3. **Table & Dashboard UX Modernization**: Elevate the UI from amateur/clunky to a high-density operational cockpit with compact numeric-aligned tables, sticky filters, quick action bars, and actionable distribution alerts.

## Architecture Decisions & Constraints
- **ADR 0002 Compliance**: All PDF documents must render server-side using Puppeteer and clean, monochrome A4 HTML templates. No client-side jsPDF libraries to prevent bundle size bloating.
- **ADR 0004 Multi-Tenancy**: Organization switching must invalidate all tenant-scoped client caches without allowing cross-tenant data leaks, while avoiding full browser reloads.
- **Permissions**: Editing company details requires `owner` or `admin` membership role in the active organization.

## Dependency Graph
```
Phase 1: Company Switching & Inline Editing (company-switching-and-editing)
    │
    ├── Phase 2: Customer Statement PDF Engine (customer-statement-pdf)
    │
    ├── Phase 3: Table UX & Ergonomics Modernization (table-ux-modernization)
    │       │
    │       └── Phase 4: Operational Dashboard Transformation (dashboard-transformation)
    │
    └── Phase 5: Extended Document PDF Suite (extended-pdf-suite)
```

---

## Phase Breakdown

### Phase 1: Company Switching & Inline Editing
- **Task 1: Organization Update API Endpoint & Role Guard**
  - Add `PATCH /api/organizations/:id` route in `apps/server/src/routes/organization.ts` allowing admins/owners to update organization `name`.
  - Wire with `PUT /api/settings` to allow updating legal `displayName`, `address`, `gstin`, `phone`, and `email`.
  - Add unit and parity tests in `apps/server/src/routes/organization.test.ts`.
- **Task 2: Zero-Reload Company Switching & "Edit Company Details" Modal**
  - Update `CompanySwitcher.tsx` to eliminate `window.location.reload()`, gracefully revalidating global SWR caches on switch.
  - Create `EditCompanyDialog.tsx` accessible directly from the topbar company dropdown for quick in-place editing of company details.
  - Update component tests in `CompanySwitcher.test.tsx`.

### Checkpoint 1: Company Switching & Editing Verified
- [ ] Switching companies updates tenant context in-place without page flash/reload.
- [ ] Users can edit current company name, GSTIN, and address directly from the switcher dropdown.

---

### Phase 2: Customer Statement PDF Engine
- **Task 3: Server-Side Customer Statement PDF Generator & Route**
  - Create `renderCustomerStatementHtml` in `apps/server/src/services/customer-statement-template.ts` with monochrome styling, company header, date range, opening balance, debit/credit ledger entries, and closing balance.
  - Add `GET /api/customers/:id/statement/pdf` route in `apps/server/src/routes/customer.ts` using Puppeteer.
  - Add route tests in `apps/server/src/routes/customer.test.ts`.
- **Task 4: Customer Statement UI Export & Print Integration**
  - Add "Download PDF" and "Print Statement" buttons to `CustomerLedgerPage.tsx`.
  - Support date-range query parameters matching the on-screen ledger filter.
  - Add unit tests in `CustomerLedgerPage.test.tsx`.

### Checkpoint 2: Customer Statement PDF Verified
- [ ] Customer statement PDF downloads cleanly from `CustomerLedgerPage`.
- [ ] PDF formatting is clean, monochrome, and strictly matches accounts data.

---

### Phase 3: Table UX & Ergonomics Modernization
- **Task 5: High-Density DataTable & Table Component Polish**
  - Modernize `packages/ui/src/components/data-table.tsx` and `table.tsx` with density variants (`compact`, `default`), right-aligned numeric columns, hover effects, and built-in empty/skeleton states.
  - Enhance `ListTablePanel.tsx` with sticky filter bars and responsive search inputs.
- **Task 6: Transaction List Tables Ergonomics Upgrade**
  - Apply the high-density layout to `SaleInvoiceList.tsx`, `PurchaseList.tsx`, and `CustomerList.tsx`.
  - Align currency values to the right, enhance status badges, and improve row action menus.

### Checkpoint 3: Table Ergonomics Verified
- [ ] Transaction tables render with crisp high-density spacing and right-aligned figures.
- [ ] Filtering, sorting, and pagination work smoothly with no layout jumps.

---

### Phase 4: Operational Dashboard Transformation
- **Task 7: Distribution Cockpit Layout & Quick Action Shortcuts**
  - Redesign `Dashboard.tsx` into a distribution operations cockpit: add quick action bar (New Invoice, New Purchase, Receive Stock, Add Customer).
  - Modernize KPI cards with refined monochrome/subtle accents, removing harsh color tiles.
- **Task 8: Actionable Operational Alert Feeds & Overdue Ledger Links**
  - Add direct actionable alert cards: Out-of-Stock items, Expiring Batches (with 1-click batch navigation), and Overdue Customer Balances (linking directly to customer statements).
  - Add test coverage in `apps/web/src/pages/Dashboard.test.tsx`.

### Checkpoint 4: Dashboard Transformation Verified
- [ ] Dashboard provides clear operational visibility with 1-click actions to urgent stock and ledger tasks.
- [ ] All tests pass and bundle size stays within limits.

---

### Phase 5: Extended Document PDF Suite
- **Task 9: Purchase Order & Goods Receipt PDF Generator**
  - Add `GET /api/purchases/:id/pdf` server route and Puppeteer template for Purchase Orders and Goods Receipt Notes.
  - Add "Download PDF" and "Print" actions to `PurchaseList.tsx` and `PurchaseNew.tsx`.
- **Task 10: Payment Receipt & Sale Return Credit Note PDF Generators**
  - Add `GET /api/payments/:id/pdf` for official Payment Collection Receipts and `GET /api/returns/:id/pdf` for Sale Return Credit Notes.
  - Add PDF download buttons to `PaymentsPage.tsx` and `ReturnList.tsx`.

### Checkpoint 5: Complete System Parity & Verification
- [ ] Full monorepo tests pass: `pnpm --filter @dms/server test && pnpm --filter @dms/web test`.
- [ ] Typecheck and lint pass cleanly: `pnpm turbo lint`.
- [ ] All major distribution transactions have professional monochrome PDF exports.

---

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Puppeteer memory leak during concurrent PDF generation | High | Ensure browser pages are closed in `finally` blocks, reuse browser instance or isolate page lifecycles. |
| In-place company switch leaves stale components | Med | Invalidate all SWR cache keys with `mutate(() => true, undefined, { revalidate: true })` and sync active organization state via context. |
| Table layout shifting on small screens | Low | Provide horizontal scrolling container with sticky action column for wide tables. |

## Open Questions
- None blocking implementation. Default statement PDF date range will match active on-screen filter, defaulting to Month-to-Date if unspecified.
