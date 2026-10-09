# Product Requirements Document

## Distribution Management System (DMS)

**Prepared by:** 404 Tech
**Prepared for:** Project Lead (for estimation)
**Date:** September 18, 2026
**Status:** Draft — client requirements captured; design decisions being locked (see §12)

> **Cross-referenced against the codebase.** Each section carries a **Codebase status**
> note stating what is already built and what is still a gap. Decisions taken during the
> design sessions are recorded as ADRs in `docs/adr/` and summarised in §12.

---

## 1. Purpose

This document lists the client's requirements for a Distribution Management System (DMS). The project lead will use this document to estimate cost and timeline. The requirements below come directly from the client. Some items need more detail before estimation. Open questions are listed in Section 8.

---

## 2. Overview

The client needs a system to manage product distribution. The system must track inventory, generate invoices, manage returns, handle credit and cash sales, and support multiple brands (agencies/companies). The system must run as a web app and as a desktop app (Electron).

**Codebase status:** ✅ A web app and an Electron shell both exist. There is now a **single web codebase** — the former parallel Next.js app was removed (ADR 0001).

---

## 3. Platform Requirements

The system must ship in two forms:

- **Web application.** Users access it through a browser.
- **Electron desktop application.** Users install it on a local machine.

Both versions share the same core logic and data model. They run against one shared backend (Express API + PostgreSQL); offline operation was considered and is deferred (see §8 Q1).

**Codebase status:**
- ✅ Electron shell exists (`apps/desktop`, productName "Inventioo DMS"). It wraps the **Vite web app** (`apps/web`).
- ✅ **Single web codebase.** The Next.js `src/` app was deleted; `apps/web` (Vite + React Router SPA talking to the Express API in `apps/server`) is the only web surface and is what Electron loads. ADR 0001. Q11 resolved.
- ⏸️ **Offline-first is deferred, not in scope.** The app requires a live API connection. ADR 0010.

---

## 4. Functional Requirements

### 4.1 Inventory Management
- Track stock levels per product.
- Track product expiry dates. The system must flag products nearing expiry or already expired.
- Support GST-applicable products and non-GST products as separate categories.
- Store tax details per product (GST rate, if applicable).

**Codebase status:** ✅ `Product` carries `gstApplicable` + `gstRate`. Batch/lot inventory with expiry (`StockBatch`) and a FEFO issue rule are implemented (checkpoint 07), plus an expiry KPI on the dashboard. Non-GST products are supported via `gstApplicable: false`.

### 4.2 SKU Generation
- Generate a unique SKU for each product.
- The client wants to define the SKU format themselves through an **interactive SKU format builder** — chosen tokens and separators, with a live preview — rather than a fixed scheme.

**Codebase status:** ✅ **Decision made (ADR 0007).** Server-generated, per-Company format (`{BRAND}-{CATEGORY}-{SEQ:5}`-style), sequence never resets, immutable after create, existing products untouched; `code` fields added to Brand/Category to feed tokens. ❌ The format-builder UI and server allocator are still to build. Q2 resolved.

### 4.3 Invoicing
- Generate invoices for sales transactions.
- Invoices must reflect GST where applicable.

**Codebase status:**
- ✅ Sale invoices exist with CGST/SGST/IGST split (intra- vs inter-state) — checkpoint 08.
- ✅ PDF export is **server-side** (Puppeteer HTML template, `GET /api/sales/:id/pdf`) — ADR 0002. The old root-`src/` base64 PDF bug is moot (that app is deleted).
- ❌ Documents are not yet monochrome (see §4.10).

### 4.4 Return Policy
- Support product returns.
- The system must apply a return policy (rules for what can be returned, and under what conditions).

**Codebase status:** ✅ **Decision made (ADR 0006, ADR 0008).** Returns are modelled (`Return`/`ReturnItem`); stock effects are re-applied/reversed. Policy is configurable per Company: **return window** (default 30 days) from the original invoice, sale returns must **reference the original invoice**, a **condition gate** (restockable vs damaged + reason), partial returns allowed up to the unreturned quantity. Sale returns settle as **store credit** (no cash refund). ❌ The settings + enforcement are still to build (checkpoint 11 is a plan + empty tests). Q3 resolved.

### 4.5 Credit and Cash Management
- Support both cash sales and credit sales.
- For credit sales, track outstanding balances per customer/distributor.

**Codebase status:** ✅ **Decision made (ADR 0005, ADR 0009).** `Customer.creditLimit` and partial `Payment`s exist. Credit sales carry a **due date** from a **credit term** (net-30 default, per-customer override); overdue balances are surfaced as an **aging report** (0–30/31–60/61–90/90+); the dashboard **Outstanding** KPI becomes a real sum of unpaid balances (currently a fabricated 25% of sales). Credit limit is **soft-blocked** (warn; override gated by `sales.override_credit_limit`); **no automatic interest/penalty** (deferred to client). ❌ Due dates, aging, enforcement, and the real KPI are still to build. Q4 resolved.

### 4.6 Multi-Agency / Multi-Brand Support *(client-emphasised)*
The client distributes one brand now (e.g. "Next Cola") but needs to onboard additional companies later. **Each company's data must be fully isolated** — products, stock, invoices and reports for one company must not bleed into another's. Users must be able to switch which company they are working in.

**Codebase status (resolved):** ✅ Each agency/company **is its own `Organization`** — the existing tenant boundary (`activeOrganizationId`). Every domain row carries `organizationId`, so one company's products/stock/invoices/customers/reports cannot bleed into another's. `Brand` stays a **product-attribution label inside** a company, not a tenant (ADR 0004). The server API (`POST /api/organizations`, `set-active`, member routes) already exists; ❌ the **organization create/switch UI is missing** and is the remaining work. Q5 resolved.

### 4.7 Role-Based Access Control (RBAC) — Basic
- The system must support basic user roles (e.g. Admin, Sales, Inventory staff).

**Codebase status:** ✅ Full RBAC rebuilt (checkpoint 06): Prisma `Role`/`RolePermission`, built-in `owner`/`admin`, per-organization custom roles, an Express `/api/roles` layer and a web permissions matrix. Beyond "basic." ⚠️ The **Team page is broken** — it calls a non-existent `/api/users` router; the real member API (`/api/organizations/:id/members`, `/api/members/:id`) exists and is unused. Q6 still open for the client's exact role list.

### 4.8 Dashboard and KPIs
- The system must show a dashboard with key metrics, including products nearing/at expiry.

**Codebase status:** ✅ Dashboard (checkpoint 13) with expiry KPI, sales/purchase reports, top products, low-stock, recent activity. ⚠️ "Outstanding" is fabricated and becomes real per ADR 0009. ❌ Which KPIs are contractual vs nice-to-have is still open (Q7).

### 4.9 Customer Ledger (A–Z) *(client-emphasised)*
A single place showing everything a customer has done: every sale invoice, every return (as a credit), every payment, and the running balance due, over a selectable date window. The statement must be shareable with the customer.

**Codebase status:** ✅ Implemented in `apps/web` (`CustomerLedgerPage`) backed by `GET /api/customers/:id/ledger` (checkpoint 16). It folds invoices (debit), sale returns (credit), and payments (credit) into a running balance with opening/closing balance over a date range. WhatsApp "share statement" opens a `wa.me` deep link (no WhatsApp API), with a clipboard fallback. ⚠️ The checkpoint-16 parity suite is a plan only. (The Next.js gap noted previously is moot — that app was deleted.)

### 4.10 Document & PDF Presentation *(client-emphasised)*
All generated documents (invoices, statements, reports) must use **clean, monochrome, professional tables** — no clashing colours, no heavy coloured fills, no inconsistent borders. Consistent black-on-white tables with restrained grey rules and a clear typographic hierarchy.

**Codebase status:** ❌ Current documents violate this: the server invoice template (`sale-invoice-template.ts`) uses a coloured "TAX INVOICE" chip and coloured totals; the client jsPDF report generator used coloured status chips (it is now dead code and will be removed — ADR 0002). Currency is already `Rs`. Restyle to monochrome is outstanding.

---

## 5. Non-Functional Requirements (assumed — to confirm with client)
- Multi-user access with authentication.
- Data must persist reliably (database-backed) given financial data is involved.
- Reasonable performance for expected inventory/transaction volume (volume not yet specified).

**Codebase status:** ✅ better-auth sessions + organization plugin (checkpoint 03). ✅ PostgreSQL via Prisma. ⚠️ Volume not specified (Q8). ⚠️ The web bundle loads every page on first paint; route-level code splitting is a committed fix (ADR 0011).

---

## 6. Out of Scope (until confirmed)
- Mobile app (only Web and Electron were requested).
- Integration with third-party accounting/GST-filing software (not mentioned by client).
- Multi-warehouse/multi-location logistics (only multi-company was specified; assumed single location — Q9).
- **Offline-first desktop operation** (deferred — ADR 0010).

---

## 7. Assumptions
- "GST, without GST" means the system supports both taxable and tax-exempt product categories in one catalog.
- "Credit and Cash" refers to payment mode per sale; credit sales require balance tracking.
- The Electron app mirrors the web app's core feature set.
- **(Decided)** "Agency/company" maps to the existing **Organization** tenant boundary, giving each company fully isolated data and a context switch (ADR 0004).

---

## 8. Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Does the Electron app need offline operation? | **Resolved — deferred, not in scope** (ADR 0010). |
| 2 | What SKU format does the client expect? | **Resolved** — client-defined via a format builder (ADR 0007). |
| 3 | Exact return policy rules? | **Resolved** — per-Company window/gate/store-credit (ADR 0006, 0008). |
| 4 | Credit terms, due periods, penalties? | **Resolved** — net-30, aging, soft-block, no interest (ADR 0005, 0009). |
| 5 | Agency = Organization or Brand-in-org? | **Resolved** — Organization (ADR 0004). |
| 6 | Specific roles and permissions needed? | **Open** — beyond owner/admin/member; needs client input. |
| 7 | KPIs beyond expiry? | **Partially resolved** — Outstanding becomes real; contractual set needs client confirmation. |
| 8 | Expected data volume? | **Open** — to size infrastructure. |
| 9 | Single-location or multi-location? | **Open** — assumed single location. |
| 10 | Existing systems to integrate with? | **Open**. |
| 11 | Which web codebase is canonical? | **Resolved** — `apps/web`; `src/` deleted (ADR 0001). |

---

## 9. Codebase Status Legend

| Marker | Meaning |
|---|---|
| ✅ | Built and present on `main`. |
| ⚠️ | Partial, or built but with a design gap/bug. |
| ❌ | Not implemented. |
| ⏸️ | Deferred by decision (not a delivery gap). |
| ❓ | Needs a decision/clarification (see Section 8). |

---

## 10. Known Defects & Gaps to Fix Before Delivery

1. **Blank `/batches` navigation:** the sidebar links to `/inventory/batches`, which has no route (and there is no catch-all route), so it renders a blank page. Fix: dedicated Batches route + catch-all redirect; fix its swallowed errors, missing skeleton, un-debounced search, and expiry filter that wrongly includes already-expired batches.
2. **Team page wired to a non-existent API:** `UsersPage`/`UserDialog` call `/api/users` (404). Rewire to `/api/organizations/:id/members` + `/api/members/:id`; align role options to the server enum (`member | owner | adminRole`).
3. **No organization create/switch UI:** users with no active organization are hard-blocked (`400 ORGANIZATION_REQUIRED`) with no path out. Add onboarding + top-right switcher.
4. **Profile page is fake:** hardcoded phone/city/org and a `setTimeout` password form. Wire to real better-auth `updateUser`/`changePassword`.
5. **PDF styling:** make all documents monochrome per §4.10; delete the uncalled client-side jsPDF generator.
6. **Fabricated dashboard KPI:** Outstanding = `totalSales * 0.25`; replace with a real unpaid-balance sum.
7. **Bloat & duplication:** oversized files (ProductForm 710, SaleInvoiceForm 684, PermissionPage 662, SaleInvoiceList 651, PurchaseForm 617, AddInventoryForm 604) and duplicated components (nested Manual/CSV tabs in `AddInventory*`, two `StatChip` implementations, dead `Stats.tsx`/`LowStockAlert.tsx`/`use-auth.ts`). Migrate to feature folders + route code splitting (ADR 0011).

---

## 11. Next Steps
- Project lead reviews this document and flags any requirement needing more detail before quoting.
- Remaining open questions (§8 Q6, Q8, Q9, Q10) to be sent to the client.
- Agreed build work proceeds from §4 statuses and §10 defects; decisions are pinned in `docs/adr/`.
- Once clarified, this PRD will be updated and finalized before estimation.

---

## 12. Decision Log

| ADR | Decision |
|---|---|
| 0001 | `apps/web` is the single canonical web surface; Next.js `src/` deleted. |
| 0002 | Invoices render server-side with Puppeteer; client jsPDF generator removed. |
| 0003 | SWR is the data-fetching convention. |
| 0004 | A distributed company (agency) maps to the `Organization` tenant. |
| 0005 | Credit limits warn instead of block (permission-gated override). |
| 0006 | Sale returns settle as store credit, not cash. |
| 0007 | SKUs are server-generated from a per-Company format and immutable. |
| 0008 | Return policy is configurable per Company. |
| 0009 | Credit sales carry due dates and age into buckets. |
| 0010 | Offline-first is deferred. |
| 0011 | Feature-folder modularity with route-level code splitting. |

Glossary terms live in `CONTEXT.md`; flow research and diagrams in `docs/stock-and-user-flow-research.md`.
