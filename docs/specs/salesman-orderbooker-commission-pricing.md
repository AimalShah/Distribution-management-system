# Specification: Salesman Commission, Order Booker Attribution, and Tiered Dynamic Pricing

## 1. Overview & Problem Statement
In beverage and FMCG distribution operations:
1. Field sales operate with two complementary roles:
   - **Order Bookers**: Field booking agents who visit retail shops and book orders. They do not log into the software and are managed as organizational staff records.
   - **Salesmen**: Authenticated personnel who dispatch, deliver, and complete sales orders.
2. Beverage distribution pricing fluctuates constantly and differs between **Retail** and **Wholesale** accounts. Sales invoices must support selecting a pricing tier while giving operators complete freedom to override/adjust unit prices per line item in real time.
3. Salesmen receive performance incentives based on physical volume: **commission per pack sold**. This calculation belongs in the administrative **Team** management area where managers evaluate sales volume over custom date ranges and apply commission rates, rather than printing commission directly on customer invoices.

---

## 2. Capability Decomposition

### Capability 1: Order Booker Management (`order-bookers`)
- **Data Model**:
  - `OrderBooker` model scoped to `Organization`:
    - `id`: CUID string primary key
    - `organizationId`: Foreign key to `Organization`
    - `code`: Unique identifier per organization (e.g., `OB-001`)
    - `name`: Full name
    - `phone`: Contact phone number (optional)
    - `isActive`: Boolean flag (default `true`)
    - Timestamps: `createdAt`, `updatedAt`
- **Backend API**:
  - `GET /order-bookers`: List active/all order bookers for current organization with search/pagination.
  - `POST /order-bookers`: Create a new order booker.
  - `PATCH /order-bookers/:id`: Update name, phone, or toggle active status.
- **Frontend UI (`UsersPage.tsx` / Team)**:
  - Add an "Order Bookers" tab to the Team page alongside Members/Staff.
  - Table displaying Code, Name, Phone, Status (Active/Inactive), and Actions (Edit, Toggle Status).
  - Clean "Add Order Booker" modal dialog.

---

### Capability 2: Tiered & Dynamic Pricing on Products and Invoices (`tiered-pricing`)
- **Data Model & Schemas**:
  - `Product`:
    - `retailPrice`: Decimal (12, 2)
    - `wholesalePrice`: Decimal (12, 2)
    - Migration: Defaults existing `unitPrice` into both `retailPrice` and `wholesalePrice`.
  - `Sale`:
    - `pricingTier`: Enum/String (`"retail"` | `"wholesale"`), default `"retail"`.
    - `salesmanId`: Foreign key to `User` (required).
    - `orderBookerId`: Foreign key to `OrderBooker` (optional).
  - Validation: Update `@dms/shared` schemas for `Product` and `SaleInvoice`.
- **Frontend UI (`SaleInvoiceForm.tsx`)**:
  - **Header Selectors**:
    - Pricing Tier toggle: `Retail` / `Wholesale`.
    - Salesman dropdown: Required; defaults to current logged-in user if available, with full member dropdown for admins.
    - Order Booker dropdown: Optional selector populated from active order bookers.
  - **Dynamic Line Pricing**:
    - When a product is added or selected, its unit price automatically defaults to either `retailPrice` or `wholesalePrice` according to the active pricing tier.
    - Switching pricing tier prompts or updates default prices for unchanged lines.
    - The `unitPrice` field on each line item remains fully editable so the operator can adjust for real-time price fluctuations.

---

### Capability 3: Salesman Commission Calculator in Team (`salesman-commission`)
- **Backend API**:
  - `GET /sales/salesman-summary`: Query parameters `salesmanId`, `startDate`, `endDate`.
  - Aggregates:
    - Count of completed sales invoices.
    - Total packs sold (sum of `quantity` across lines of completed invoices).
    - Total sales amount ($ / Rs).
    - List of sales orders with date, invoice code, customer name, and packs count.
- **Frontend UI (`UsersPage.tsx` / Team)**:
  - In the Members list, add a "Commission" action for sales personnel.
  - **Commission Calculator Modal**:
    - Date range picker (e.g. Start Date and End Date).
    - Metrics cards: Total Invoices, Total Beverage Packs Sold, Total Revenue.
    - Interactive input: `Commission Rate per Pack` (e.g. `2.50`).
    - Real-time computation: `Total Packs Sold × Rate = Total Commission Due`.
    - Printable/Exportable summary view for payroll distribution.

---

## 3. Acceptance Criteria & Verification

1. **Order Bookers**:
   - Admin can create an Order Booker without email or password.
   - Inactive order bookers are hidden from the invoice creation dropdown.
2. **Sale Invoices**:
   - Creating an invoice allows selecting Pricing Tier (Retail vs. Wholesale).
   - Selecting a product loads the corresponding tier price into the line item.
   - Operator can modify the line item unit price to any custom value and successfully save.
   - Invoices save with attributed `salesmanId` and optional `orderBookerId`.
3. **Commission Calculation**:
   - Admin can open the Commission Calculator for a salesman, filter by date range, and see the exact pack count from completed sales.
   - Entering a commission rate per pack immediately computes the correct total commission.
