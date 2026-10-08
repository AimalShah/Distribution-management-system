# Product Requirements Document

## Distribution Management System (DMS)

**Prepared by:** 404 Tech
**Prepared for:** Project Lead (for estimation)
**Date:** September 18, 2026
**Status:** Draft — requirements gathered from client, pending estimation

> **Cross-referenced against the codebase.** Each section carries a **Codebase status**
> note stating what is already built in this repository and what is still a gap.

---

## 1. Purpose

This document lists the client's requirements for a Distribution Management System (DMS). The project lead will use this document to estimate cost and timeline. The requirements below come directly from the client. Some items need more detail before estimation. Open questions are listed in Section 8.

---

## 2. Overview

The client needs a system to manage product distribution. The system must track inventory, generate invoices, manage returns, handle credit and cash sales, and support multiple brands (agencies/companies). The system must run as a web app and as a desktop app (Electron).

**Codebase status:** ✅ A web app and an Electron shell both exist. See Section 3 for an important architecture note — there are two parallel web codebases in this repo.

---

## 3. Platform Requirements

The system must ship in two forms:

- **Web application.** Users access it through a browser.
- **Electron desktop application.** Users install it on a local machine.

Both versions must share the same core logic and data model. The client did not specify if the two versions sync through one shared backend or work offline-first. This needs clarification (see Section 8).

**Codebase status:**
- ✅ Electron shell exists (`apps/desktop`, productName "Inventioo DMS"). It wraps the **Vite web app** (`apps/web`).
- ⚠️ **Two web codebases exist** and must be reconciled before estimation:
  1. `src/` — a **Next.js** app (server actions, direct Prisma, Puppeteer PDFs).
  2. `apps/web` — a **Vite + React Router** SPA talking to an Express API (`apps/server`), which the Electron shell actually loads.
  The root `src/` app is a parallel/legacy surface. The checkpoints/parity work and the Electron build both point to `apps/web`.
- ❓ Offline-first behaviour is **not** implemented. The web app requires a live API connection.

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
- The client did not specify a SKU format (e.g., brand code + category code + sequence number). This needs clarification.

**Codebase status:** ⚠️ `productCode` is a unique, client-supplied code — **not** an auto-generated SKU. No generation algorithm exists. See Section 8, Q2.

### 4.3 Invoicing
- Generate invoices for sales transactions.
- Invoices must reflect GST where applicable.
- The client did not specify invoice numbering rules, tax breakdown format, or whether invoices need to be printable/exportable (PDF). This needs clarification.

**Codebase status:**
- ✅ Sale invoices exist with CGST/SGST/IGST split (intra- vs inter-state) — checkpoint 08.
- ✅ PDF export exists in **two** places: Puppeteer HTML template (`src/`) and jsPDF autotable (`apps/web`). See Section 4.10 for the required restyle.
- 🐞 **Bug (root `src/` app):** `generateInvoicePDF` returns the PDF as a **base64 string**, but the download handler (`SaleInvoiceAcBtn.tsx`) decodes it with `res.pdf.split(",").map(Number)` — treating base64 as a comma-separated byte list. **Every PDF downloaded from the Next.js app is corrupted.**

### 4.4 Return Policy
- Support product returns.
- The system must apply a return policy (rules for what can be returned, and under what conditions).
- The client did not specify the exact return rules (time window, condition checks, partial returns). This needs clarification.

**Codebase status:** ✅ Returns are modelled (`Return`/`ReturnItem`) with types SALE, PURCHASE, EXPIRED, DAMAGED, and stock effects are re-applied/reversed. ❌ No configurable *policy rules* (time window, condition gates) exist yet. See Section 8, Q3.

### 4.5 Credit and Cash Management
- Support both cash sales and credit sales.
- For credit sales, the system must track outstanding balances per customer/distributor.
- The client did not specify credit limits, payment terms, or overdue tracking. This needs clarification.

**Codebase status:** ✅ `Customer.creditLimit` exists; `Payment` records (allocated or on-account) offset balances; partial payments supported (checkpoint 15). ❌ No payment *terms*, due dates, or overdue/penalty tracking. See Section 8, Q4.


### 4.6 Multi-Agency / Multi-Brand Support *(client-emphasised)*
The client is a distributor that currently distributes one brand (e.g. "Next Cola") but needs the option to onboard additional agencies/companies later. **Each agency's data must be fully isolated** — the products, stock, invoices and reports for one company must not bleed into another's. Users must be able to switch which agency they are working in.

- Each brand acts as its own inventory pool — products, stock counts, and invoicing scoped to a brand profile.
- Data for one agency must be isolated from every other agency.

**Codebase status:**
- ⚠️ **Partial / by design gap.** Today `Organization` is the tenant and `Brand` is nested *inside* one organization — brands share the same product catalog, customers, and invoices. Brand-scoping (checkpoint 09) is implemented only as **report filters** (`/reports/sales/by-brand`, `/reports/purchase/by-brand`), not as hard data isolation.
- ✅ Switching context exists at the **Organization** level (`activeOrganizationId`, subdomain route `/c/[company]`). If the client means "each agency = its own Organization," the isolation and switching requirements are already largely met by the existing tenant model — this is the recommended interpretation.
- ❌ If instead each agency must be a `Brand` *within* a single organization, new work is required to isolate products, stock, customers, invoices, users, and reports per brand.
- See Section 8, Q5 for the decision that drives the estimate.

### 4.7 Role-Based Access Control (RBAC) — Basic
- The system must support basic user roles (e.g., Admin, Sales, Inventory staff).
- The client asked for "basic" RBAC — exact roles and permissions per role are not yet defined. This needs clarification.

**Codebase status:** ✅ Full RBAC rebuilt (checkpoint 06): Prisma `Role`/`RolePermission`, built-in `owner`/`admin`, per-organization custom roles, an Express `/api/roles` layer and a web permissions matrix. Beyond "basic." See Section 8, Q6.

### 4.8 Dashboard and KPIs
- The system must show a dashboard with key metrics, including products nearing/at expiry.
- Other KPIs are implied but not listed by the client (e.g., sales volume, outstanding credit, stock levels by brand). This needs clarification.

**Codebase status:** ✅ Dashboard (checkpoint 13) with expiry KPI, sales/purchase reports, top products, and low-stock. ❓ Which of these are contractual KPIs vs. nice-to-have is undecided. See Section 8, Q7.

### 4.9 Customer Ledger (A–Z) *(client-emphasised)*
The client wants a **customer ledger** — a single place showing everything a customer has done with the business, from A to Z: every sale invoice, every return (as a credit), every payment, and the running balance due, over a selectable date window. The statement must be shareable with the customer.

**Codebase status:**
- ✅ Implemented in `apps/web` (`CustomerLedgerPage`) backed by `GET /api/customers/:id/ledger` (checkpoint 16). It folds invoices (debit), sale returns (credit), and payments (credit) into a running balance with an opening/closing balance over a date range. WhatsApp "share statement" opens a `wa.me` deep link (no WhatsApp API integration) with a clipboard fallback.
- ⚠️ Marked **Partial**: code + server tests exist on `main`, but the parity suite is a plan only.
- ❌ **Not present in the root `src/` Next.js app.** Whichever app is canonical must carry this feature.

### 4.10 Document & PDF Presentation *(client-emphasised)*
All generated documents (invoices, statements, reports) must use **clean, monochrome, professional tables**. The client explicitly asked for **no "nasty" layouts** — no clashing colours, no heavy coloured fills, no inconsistent borders. Consistent black-on-white tables with restrained grey rules and a clear typographic hierarchy.

**Codebase status:** ❌ Current PDFs violate this:
- `apps/web` PDF (`generateQuickReportPdf.ts`) uses **coloured status chips** (green/amber/red fills) and coloured accents — must be made monochrome.
- Root `src/` Puppeteer invoice template uses grey borders and a **`$` currency symbol** (this is an Indian-GST context — money should render as `Rs`).

---

## 5. Non-Functional Requirements (assumed — to confirm with client)
- Multi-user access with authentication.
- Data must persist reliably (database-backed) given financial data is involved.
- Reasonable performance for expected inventory/transaction volume (volume not yet specified).

**Codebase status:** ✅ better-auth sessions + organization plugin (checkpoint 03). ✅ PostgreSQL via Prisma. Volume not specified.

---

## 6. Out of Scope (until confirmed)
- Mobile app (only Web and Electron were requested).
- Integration with third-party accounting/GST-filing software (not mentioned by client).
- Multi-warehouse/multi-location logistics (only multi-agency/multi-brand was specified).

---

## 7. Assumptions
- "GST, without GST" means the system supports both taxable and tax-exempt product categories in one catalog.
- "Credit and Cash" refers to payment mode per sale; credit sales require balance tracking.
- The Electron app mirrors the web app's core feature set.
- *(Recommended)* "Agency/company" maps to the existing **Organization** tenant boundary, giving each agency fully isolated data and a context switch for free. *(Confirm — see Section 8, Q5.)*

---

## 8. Open Questions (need client clarification before estimation)
1. Does the Electron app need to work offline, or does it always require a live connection to a central server?
2. What SKU format does the client expect (auto-generated pattern)?
3. What are the exact return policy rules (time window, conditions, partial returns, refund vs. exchange)?
4. What are the credit terms — credit limits, payment due periods, interest/penalties on overdue balances?
5. **Is each agency a separate Organization (already isolated) or a Brand inside one shared organization (needs new isolation work)?**
6. What specific roles and permissions are needed for RBAC (beyond "basic")?
7. What KPIs beyond expiry should appear on the dashboard?
8. Expected data volume (products, brands, transactions/day) — to size infrastructure.
9. Single-location only, or multi-location/warehouse?
10. Any existing systems (accounting, GST filing, POS) to integrate with?
11. **Which web codebase is canonical — the Next.js `src/` app or the Vite `apps/web` app?** (They duplicate features today; the Electron build uses `apps/web`.)

---

## 9. Codebase Status Legend

| Marker | Meaning |
|---|---|
| ✅ | Built and present on `main`. |
| ⚠️ | Partial, or built but with a design gap/bug. |
| ❌ | Not implemented. |
| ❓ | Needs a decision/clarification (see Section 8). |

---

## 10. Known Defects to Fix Before Delivery
1. **PDF corruption (root `src/` app):** base64 PDF decoded as comma-separated bytes in `SaleInvoiceAcBtn.tsx` → every download is broken.
2. **Currency symbol:** root `src/` invoice prints `$`; should be `Rs` for the Indian-GST context.
3. **PDF styling:** `apps/web` report PDF uses coloured chips; make all documents monochrome per Section 4.10.
4. **Duplicated web surfaces:** reconcile root `src/` vs `apps/web` (Section 8, Q11).

---

## 11. Next Steps
- Project lead reviews this document and flags any requirement needing more detail before quoting an estimate.
- Open questions (Section 8) to be sent back to the client for clarification.
- Decide the canonical web codebase and the agency-isolation model (Q5, Q11) — both materially change the estimate.
- Once clarified, this PRD will be updated and finalized before estimation.
