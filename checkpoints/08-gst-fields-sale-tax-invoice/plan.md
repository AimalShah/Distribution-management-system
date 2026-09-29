# Checkpoint 8 — GST Fields + Sale Tax Invoice: Plan

## Goal

Add `gstApplicable`/`gstRate` fields to `Product`, `invoiceType` field to `Sale`, and GST breakdown line in the invoice template.

## Schema Changes

### Modified Product Model

```prisma
model Product {
  // ... existing fields ...
  gstApplicable  Boolean  @default(true)
  gstRate        Float    @default(0)  // GST rate in percentage (e.g., 18 for 18%)
}
```

### Modified Sale Model

```prisma
model Sale {
  // ... existing fields ...
  invoiceType    String   @default("regular")  // "regular" | "tax"
  cgstAmount     Float    @default(0)
  sgstAmount     Float    @default(0)
  igstAmount     Float    @default(0)
}
```

### Modified SaleItem Model

```prisma
model SaleItem {
  // ... existing fields ...
  cgstRate       Float    @default(0)
  sgstRate       Float    @default(0)
  igstRate       Float    @default(0)
  cgstAmount     Float    @default(0)
  sgstAmount     Float    @default(0)
  igstAmount     Float    @default(0)
}
```

## Implementation Steps

### 1. Schema migration
- Add GST fields to Product, Sale, SaleItem
- Create migration

### 2. Service layer updates
- `addProduct` — accept and store `gstApplicable` and `gstRate`
- `addSaleInvoice` — calculate GST breakdown:
  - For intra-state sales: CGST + SGST (each = gstRate/2)
  - For inter-state sales: IGST (= gstRate)
  - Store CGST/SGST/IGST amounts on Sale and SaleItem
- `updateSaleInvoice` — recalculate GST on item changes

### 3. Express endpoints
- Product endpoints accept/return GST fields
- Sale endpoints accept/return `invoiceType` and GST breakdown
- `GET /api/sales/:id/invoice` — returns invoice with GST breakdown

### 4. Invoice template updates
- Update `saleInvoiceSkeleton.tsx` (or its React equivalent) to show GST breakdown:
  - GST rate per item
  - CGST, SGST, IGST amounts
  - Total tax amount
  - "Tax Invoice" header when `invoiceType === "tax"`

### 5. React UI
- Product form: add `gstApplicable` (switch) and `gstRate` (number input) fields
- Sale invoice form: add `invoiceType` select (Regular/Tax Invoice)
- Invoice print template: GST breakdown table

## Verification

- Product form saves GST fields
- Sale invoice calculates GST correctly
- Invoice template shows GST breakdown
- Tax invoice type shows "Tax Invoice" header
- CGST/SGST split correctly for intra-state
- IGST calculated correctly for inter-state
