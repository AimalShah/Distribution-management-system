# Dashboard UX Overhaul, Seamless Company Management & Document PDF Suite

## Problem Statement
How might we transform the Distribution Management System from a clunky, reload-heavy interface into a snappy operational cockpit with keyboard-dense tables, seamless zero-reload company switching and inline editing, and a complete suite of print-ready monochrome PDF documents?

## Recommended Direction
We adopt a **two-slice phased implementation** prioritizing high-frequency operational bottlenecks first before broad document expansion. 

In **Slice 1 (Core Ergonomics & Financial Statements)**, we overhaul topbar company switching in `CompanySwitcher.tsx` to eliminate hard browser reloads (`window.location.reload()`), introduce an inline "Edit Active Company" dialog to update legal details (name, GSTIN, address, contact) in place, and deliver a clean server-rendered Customer Statement PDF endpoint (`GET /api/customers/:id/statement/pdf`) integrated directly into `CustomerLedgerPage.tsx`. Concurrently, we refine table density, number alignments, and sticky search bars across primary list views (`SaleInvoiceList`, `CustomerList`, `PurchaseList`).

In **Slice 2 (Full Document Suite & Operational Cockpit)**, we expand the server-side Puppeteer engine to generate monochrome PDFs for Purchase Orders, Payment Receipts, and Return Credit Notes, while redesigning `Dashboard.tsx` into an action-oriented distribution cockpit focused on urgent inventory alerts, expiring batches, and pending receivables.

## Key Assumptions to Validate
- [ ] **Zero-Reload State Consistency:** Switching the active organization via `/api/organizations/set-active` followed by global SWR revalidation correctly flushes and updates all company-scoped caches without stale data leaks. *(Validate by testing cross-company navigation in a multi-tenant test account without refreshing the browser).*
- [ ] **Monochrome PDF Performance:** Generating A4 customer statements and documents via server Puppeteer responds in < 1.2s without blocking the API event loop during concurrent requests. *(Validate via load test on `GET /api/customers/:id/statement/pdf` with 500+ ledger entries).*
- [ ] **Company Edit Permissions:** Only company admins/owners can update legal company metadata (GSTIN, legal name, address), while standard operators have read-only access. *(Validate against membership role gates in the API and UI).*

## MVP Scope (Slice 1)

### What's In:
1. **Company Switcher & Quick Edit Dialog:**
   - Seamless active organization swap without page reload (clean SWR cache reset).
   - "Edit Company Details" modal accessible directly from the switcher dropdown for admins (modifies name, address, GSTIN, contact).
2. **Customer Statement PDF:**
   - Server-side monochrome A4 statement generator (`GET /api/customers/:id/statement/pdf`) matching ADR 0002.
   - Includes opening balance, chronological debit/credit ledger, running balance, totals, and company GSTIN header.
   - Dedicated "Download Statement PDF" and "Print" actions on `CustomerLedgerPage.tsx`.
3. **Table UX & Ergonomics Polish:**
   - Increased row density and compact typography for high-volume transactions.
   - Proper right-alignment for all monetary figures and quantities.
   - Distinct, accessible status chips and sticky filter/search bars.
   - Clear empty and loading skeleton states.

### What's Out (Deferred to Slice 2):
- Secondary document PDFs (Purchase Orders, Payment Vouchers, Credit Notes, Executive Aging Reports).
- Custom dashboard drag-and-drop widget customization.
- Client-side PDF generation (explicitly rejected to prevent bundle size bloating).

## Not Doing (and Why)
- **Client-Side jsPDF Generation:** Rejected because it causes massive client bundle bloat (>1.2 MB), drifts from backend calculation rules, and produces inconsistent styling compared to server Puppeteer templates.
- **Customizable Dashboard Builder:** Out of scope. Distribution operators need immediate, opinionated visibility into expiring batches and receivables, not configurable layout widgets.
- **Full Settings Page Rewrite:** The existing `CompanySettingsPage.tsx` handles SKU sequences and brand managers well; we will only connect the quick-edit dialog to the shared update endpoints rather than rebuilding the entire settings module.

## Open Questions
- What default date range should the Customer Statement PDF cover when exported (e.g., current financial year, last 30 days, or matching the active date-filter on screen)?
- Should customer statements include item-level product breakdowns or remain strictly financial transaction summaries (invoice balance, payment, credit note)?
