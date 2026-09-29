# Checkpoint 12 — Client's Invoice Layout Swap-In: Plan

## Goal

Once the client provides their invoice layout, rewrite the sale invoice template to match it.

## Current State

- `saleInvoiceSkeleton.tsx` exists as the current invoice template
- It's a React component rendered to HTML for printing
- PDF generation uses Puppeteer to render the HTML

## Implementation Steps

### 1. Receive client layout
- Obtain the client's invoice layout (image, PDF, or detailed spec)
- Identify all fields, sections, and their positions
- Note any branding requirements (logo, colors, fonts)

### 2. Create new invoice template
- Create `apps/web/src/components/invoices/ClientInvoiceTemplate.tsx`
- Implement the client's layout exactly
- Support all data fields from the Sale model:
  - Invoice number, date, due date
  - Customer info (name, address, GST number)
  - Line items (product, quantity, rate, amount, tax)
  - Subtotal, discount, tax breakdown (CGST/SGST/IGST), total
  - Payment terms, notes
  - Company info (name, address, logo, GST number)

### 3. PDF generation
- Update `GET /api/sales/:id/pdf` to use the new template
- Ensure PDF output matches the client's layout exactly
- Support header/footer on multi-page invoices

### 4. Print view
- Update `GET /api/sales/:id/print` to use the new template
- Ensure print output matches the client's layout

### 5. Configuration
- Make the template configurable (allow switching between default and client layout)
- Store template preference in OrganizationSettings

## Verification

- Invoice template matches client's layout exactly
- PDF generation produces correct output
- Print view matches PDF output
- All data fields are correctly populated
- Multi-page invoices render correctly
- GST breakdown is shown correctly
