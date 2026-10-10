# Task List: Dashboard UX, Company Management & Document PDF Suite

## Phase 1: Company Switching & Inline Editing (`company-switching-and-editing`)

- [x] **Task 1: Organization Update API Endpoint & Role Guard**
  - **Description:** Implement a `PATCH /api/organizations/:id` route that permits organization owners/admins to update the organization's name, and verify that legal profile fields in settings can be updated synchronously.
  - **Acceptance criteria:**
    - [x] `PATCH /api/organizations/:id` updates organization name when caller is an admin/owner
    - [x] Rejects requests with 403 Forbidden if the user lacks admin privileges in that organization
    - [x] Returns the updated organization entity with updated timestamp
  - **Verification:**
    - [x] Tests pass: `pnpm --filter @dms/server test src/routes/organization.test.ts`
    - [x] Build succeeds: `pnpm --filter @dms/server build`
  - **Dependencies:** None
  - **Files likely touched:**
    - `packages/shared/src/schemas/organization.ts`
    - `apps/server/src/services/organization.ts`
    - `apps/server/src/routes/organization.ts`
    - `apps/server/src/routes/organization.test.ts`
  - **Estimated scope:** M (4 files)

- [x] **Task 2: Zero-Reload Company Switching & "Edit Company Details" Modal**
  - **Description:** Overhaul `CompanySwitcher.tsx` to switch active organizations smoothly via SWR global cache revalidation rather than full-page browser reloads, and introduce an `EditCompanyDialog` accessible directly from the switcher dropdown.
  - **Acceptance criteria:**
    - [x] Switching company calls `/organizations/set-active` and invalidates SWR cache without calling `window.location.reload()`
    - [x] Switcher dropdown contains an "Edit Company Details" action for active organization admins
    - [x] `EditCompanyDialog` allows editing company name, display name, address, and GSTIN with instant toast feedback
  - **Verification:**
    - [x] Tests pass: `pnpm --filter @dms/web test src/components/layout/CompanySwitcher.test.tsx`
    - [x] Build succeeds: `pnpm --filter @dms/web build`
  - **Dependencies:** Task 1
  - **Files likely touched:**
    - `apps/web/src/components/layout/CompanySwitcher.tsx`
    - `apps/web/src/components/settings/EditCompanyDialog.tsx`
    - `apps/web/src/components/layout/CompanySwitcher.test.tsx`
  - **Estimated scope:** M (3 files)

### Checkpoint 1: Company Switching & Editing Verified
- [x] Switching companies updates tenant context in-place without page flash or reload
- [x] Users can edit current company details directly from the topbar switcher dropdown

---

## Phase 2: Customer Statement PDF Engine (`customer-statement-pdf`)

- [x] **Task 3: Server-Side Customer Statement PDF Generator & Route**
  - **Description:** Implement a clean, monochrome A4 HTML statement template and server route `GET /api/customers/:id/statement/pdf` utilizing Puppeteer per ADR 0002.
  - **Acceptance criteria:**
    - [x] `renderCustomerStatementHtml` formats company header, customer details, opening balance, transaction rows, running balances, and closing totals
    - [x] Route `GET /api/customers/:id/statement/pdf` generates and returns PDF binary with appropriate `content-disposition` header
    - [x] Respects `from` and `to` query parameters matching statement ledger window
  - **Verification:**
    - [x] Tests pass: `pnpm --filter @dms/server test src/routes/customer.test.ts`
    - [x] Build succeeds: `pnpm --filter @dms/server build`
  - **Dependencies:** None
  - **Files likely touched:**
    - `apps/server/src/services/customer-statement-template.ts`
    - `apps/server/src/services/customer-pdf.ts`
    - `apps/server/src/routes/customer.ts`
    - `apps/server/src/routes/customer.test.ts`
  - **Estimated scope:** M (4 files)

- [x] **Task 4: Customer Statement UI Export & Print Integration**
  - **Description:** Integrate "Download PDF" and "Print Statement" action buttons on `CustomerLedgerPage.tsx` using the server PDF endpoint.
  - **Acceptance criteria:**
    - [x] `CustomerLedgerPage` renders "Download Statement (PDF)" and "Print Statement" buttons alongside WhatsApp action
    - [x] Clicking Download triggers PDF file download with filename `statement-[customer]-[date].pdf`
    - [x] Carries active date-range filter into the PDF generation request
  - **Verification:**
    - [x] Tests pass: `pnpm --filter @dms/web test src/pages/CustomerLedgerPage.test.tsx`
    - [x] Build succeeds: `pnpm --filter @dms/web build`
  - **Dependencies:** Task 3
  - **Files likely touched:**
    - `apps/web/src/pages/CustomerLedgerPage.tsx`
    - `apps/web/src/pages/CustomerLedgerPage.test.tsx`
  - **Estimated scope:** S (2 files)

### Checkpoint 2: Customer Statement PDF Verified
- [x] Customer statement PDF downloads cleanly from `CustomerLedgerPage`
- [x] PDF document strictly matches accounts figures with clean monochrome typography

---

## Phase 3: Table UX & Ergonomics Modernization (`table-ux-modernization`)

- [x] **Task 5: High-Density DataTable & Table Component Polish**
  - **Description:** Modernize `@dms/ui` DataTable with density modes, numeric alignment support, striped/hover states, and improved empty and skeleton states.
  - **Acceptance criteria:**
    - [x] `DataTable` supports `density="compact"` for higher information density in operational workflows
    - [x] Table headers and cells support text alignment helpers (e.g. numeric right-alignment)
    - [x] Integrated empty state illustration and skeleton rows
  - **Verification:**
    - [x] Tests pass: `pnpm --filter @dms/ui typecheck`
    - [x] Build succeeds: `pnpm --filter @dms/ui typecheck`
  - **Dependencies:** None
  - **Files likely touched:**
    - `packages/ui/src/components/data-table.tsx`
    - `packages/ui/src/components/table.tsx`
    - `apps/web/src/components/list/ListTablePanel.tsx`
  - **Estimated scope:** M (3 files)

- [x] **Task 6: Transaction List Tables Ergonomics Upgrade**
  - **Description:** Apply compact table styling, proper currency right-alignment, and clean status chips across `SaleInvoiceList`, `CustomerList`, and `PurchaseList`.
  - **Acceptance criteria:**
    - [x] Numeric amounts (totals, taxes, balances) are right-aligned with monospace/tabular digits
    - [x] Table rows feature smooth hover highlights and compact action dropdown buttons
    - [x] Filter and search bars remain accessible with keyboard shortcuts
  - **Verification:**
    - [x] Tests pass: `pnpm --filter @dms/web test src/pages/ProductList.test.tsx`
    - [x] Build succeeds: `pnpm --filter @dms/web build`
  - **Dependencies:** Task 5
  - **Files likely touched:**
    - `apps/web/src/pages/SaleInvoiceList.tsx`
    - `apps/web/src/pages/CustomerList.tsx`
    - `apps/web/src/pages/PurchaseList.tsx`
  - **Estimated scope:** M (3 files)

### Checkpoint 3: Table Ergonomics Verified
- [x] Transaction tables render with high-density spacing and clear numeric alignments
- [x] Filter and pagination interactions feel instant and intuitive

---

## Phase 4: Operational Dashboard Transformation (`dashboard-transformation`)

- [x] **Task 7: Distribution Cockpit Layout & Quick Action Shortcuts**
  - **Description:** Redesign the dashboard layout into an operational distribution cockpit with top quick-action buttons and refined, high-contrast KPI cards.
  - **Acceptance criteria:**
    - [x] Quick Action Bar at top: "New Invoice", "New Purchase", "Receive Stock", "New Customer"
    - [x] Redesigned KPI cards replace harsh colored boxes with clean typography and subtle status accents
    - [x] Preserves all existing time-window selectors (30d, MTD, YTD)
  - **Verification:**
    - [x] Tests pass: `pnpm --filter @dms/web test src/pages/Dashboard.test.tsx`
    - [x] Build succeeds: `pnpm --filter @dms/web build`
  - **Dependencies:** None
  - **Files likely touched:**
    - `apps/web/src/pages/Dashboard.tsx`
    - `apps/web/src/components/dashboard/Stats.tsx`
    - `apps/web/src/components/dashboard/Panel.tsx`
  - **Estimated scope:** M (3 files)

- [x] **Task 8: Actionable Operational Alert Feeds & Overdue Ledger Links**
  - **Description:** Introduce actionable alerts on the dashboard for critical inventory shortages, expiring batches, and high overdue customer balances with 1-click links to their statements.
  - **Acceptance criteria:**
    - [x] Urgent Attention card highlights stockouts, expired batches, and expiring lots within 30 days
    - [x] Overdue Receivables list links directly to corresponding customer statement pages
    - [x] Loading and empty states render gracefully without layout shifts
  - **Verification:**
    - [x] Tests pass: `pnpm --filter @dms/web test src/pages/Dashboard.test.tsx`
    - [x] Build succeeds: `pnpm --filter @dms/web build`
  - **Dependencies:** Task 7
  - **Files likely touched:**
    - `apps/web/src/pages/Dashboard.tsx`
    - `apps/web/src/components/dashboard/ExpiringSoonCard.tsx`
    - `apps/web/src/pages/Dashboard.test.tsx`
  - **Estimated scope:** M (3 files)

### Checkpoint 4: Dashboard Transformation Verified
- [x] Dashboard acts as an operational cockpit for warehouse operators and billing staff
- [x] 1-click workflows connect dashboard alerts directly to invoices, receipts, and customer statements

---

## Phase 5: Extended Document PDF Suite (`extended-pdf-suite`)

- [x] **Task 9: Purchase Order & Goods Receipt PDF Generator**
  - **Description:** Create server-side monochrome PDF generation for Purchase Orders (`GET /api/purchases/:id/pdf`) and wire download actions into purchase pages.
  - **Acceptance criteria:**
    - [x] `GET /api/purchases/:id/pdf` generates A4 monochrome Purchase Order / Goods Receipt Note
    - [x] Includes supplier details, purchase items, tax, and total payable
    - [x] "Download PDF" action available in `PurchaseList` and `PurchaseNew`
  - **Verification:**
    - [x] Tests pass: `pnpm --filter @dms/server test src/routes/purchase.test.ts`
    - [x] Build succeeds: `pnpm turbo build`
  - **Dependencies:** Task 3
  - **Files likely touched:**
    - `apps/server/src/services/purchase-pdf.ts`
    - `apps/server/src/routes/purchase.ts`
    - `apps/server/src/routes/purchase.test.ts`
    - `apps/web/src/pages/PurchaseList.tsx`
  - **Estimated scope:** M (4 files)

- [x] **Task 10: Payment Receipt & Sale Return Credit Note PDF Generators**
  - **Description:** Create server-side monochrome PDF generators for Payment Receipts (`GET /api/payments/:id/pdf`) and Sale Return Credit Notes (`GET /api/returns/:id/pdf`).
  - **Acceptance criteria:**
    - [x] `GET /api/payments/:id/pdf` outputs formal payment collection receipt
    - [x] `GET /api/returns/:id/pdf` outputs formal credit note referencing original invoice
    - [x] "Download PDF" buttons integrated into `PaymentsPage` and `ReturnList`
  - **Verification:**
    - [x] Tests pass: `pnpm --filter @dms/server test src/routes/payment.test.ts src/routes/return.test.ts`
    - [x] Build succeeds: `pnpm turbo build`
  - **Dependencies:** Task 9
  - **Files likely touched:**
    - `apps/server/src/services/payment-pdf.ts`
    - `apps/server/src/services/return-pdf.ts`
    - `apps/server/src/routes/payment.ts`
    - `apps/server/src/routes/return.ts`
    - `apps/web/src/pages/PaymentsPage.tsx`
    - `apps/web/src/pages/ReturnList.tsx`
  - **Estimated scope:** L (6 files)

### Checkpoint 5: Complete System Parity & Verification
- [x] All server, shared, and web tests pass
- [x] Complete document suite (Invoices, Customer Statements, Purchase Orders, Receipts, Credit Notes) generates crisp monochrome PDFs
- [x] No regression in bundle size or lint checks
