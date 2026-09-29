# Checkpoint 9 — Brand-Scoping on Sale/Purchase: Plan

## Goal

Implement brand-scoping on Sale and Purchase documents. **Client decision needed:** single-brand-per-invoice vs. brand-filtered reports only.

## Open Question for Client

Before implementation, the client needs to decide:

**Option A — Single brand per invoice:**
- Each Sale/Purchase must be for products of a single brand
- Enforced at the form level (filter products by selected brand)
- Simpler data model, simpler validation
- May not match real-world scenarios where invoices span multiple brands

**Option B — Brand-filtered reports only:**
- Invoices can contain products from any brand
- Reports can be filtered/grouped by brand
- More flexible, matches real-world scenarios
- No schema changes needed, just report queries

**Recommendation:** Option B is more flexible and requires no schema changes. Option A adds constraints that may not match business needs.

## Implementation (assuming Option B — brand-filtered reports)

### 1. No schema changes needed
- Products already have `brandId`
- Sales/Purchases already link to Products

### 2. Report enhancements
- `getSalesByProduct` — add brand filter
- `getPurchaseByProduct` — add brand filter
- `getBasicSalesReport` — add brand breakdown
- `getBasicPurchaseReport` — add brand breakdown

### 3. Express endpoints
- `GET /api/reports/sales/by-product?brandId=xxx` — filter by brand
- `GET /api/reports/purchase/by-product?brandId=xxx` — filter by brand
- `GET /api/reports/sales/by-brand` — sales grouped by brand
- `GET /api/reports/purchase/by-brand` — purchases grouped by brand

### 4. React UI
- Reports page: add brand filter dropdown
- New "By Brand" report tab
- Brand selector in report filters

## Alternative Implementation (if Option A — single brand per invoice)

### Schema Changes
- Add `brandId` to `Sale` and `Purchase` models
- Add validation: all items must belong to the same brand

### Service Layer
- `addSaleInvoice` — validate all items have same brand, set `brandId` on sale
- `addPurchase` — same validation

### React UI
- Sale/Purchase form: brand selector at top, filter products by brand

## Verification

- Brand filter works on all relevant reports
- Brand-grouped reports show correct data
- (If Option A) Single-brand validation works
