# Checkpoint 4d — Sale Invoice Pages: Source Review

## Source Review: `src/app/(app)/sale-invoice/page.tsx` + `src/app/(app)/sale-invoice/new/page.tsx` + `src/components/sale-invoice/*`

### Page: `src/app/(app)/sale-invoice/page.tsx`

**Data fetched:**
- Sales invoices list (all sales for current org)

**Components used:**
- `SaleInvoiceTable` — table with sales list

**Features:**
- View invoice detail
- Print/PDF generation
- Status badges

### Page: `src/app/(app)/sale-invoice/new/page.tsx`

**Components used:**
- `SaleInvoiceForm` — form with customer select, items array

**Data fetched:**
- Customers (for dropdown)
- Products (for item rows)

### Components

#### `SaleInvoiceTable.tsx`
- Table with columns: Sale Code, Customer, Date, Status, Total, Actions
- View/print/PDF buttons per row

#### `SaleInvoiceForm.tsx`
- Form with: customer select, sale code, status, discount, tax
- Dynamic item rows: product select, quantity, unit price, tax %, discount
- Calculates totals
- Submit calls `createSaleInvoice` or `editSaleInvoice`

#### `saleInvoiceSkeleton.tsx`
- Invoice print template (HTML layout for printing)
- Used by `printInvoice` and `generateInvoicePDF`

#### `SaleInvoiceAcBtn.tsx`
- Action buttons for sale invoice (view, print, PDF)

### Bugs/Assumptions

1. Sale invoice list is not paginated
2. PDF generation uses Puppeteer (server-side) — needs to be handled differently in Express
3. Invoice template is a React component rendered to HTML for printing
