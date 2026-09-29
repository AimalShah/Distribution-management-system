# Checkpoint 11 — Return Policy Settings, Credit Terms/Overdue, Customer GST Number: Plan

## Goal

Add admin-configurable return policy settings, credit terms/overdue tracking, and customer GST number field.

## Schema Changes

### New Settings Model

```prisma
model OrganizationSettings {
  id                    String   @id @default(cuid())
  organizationId        String   @unique
  returnWindowDays      Int      @default(30)
  allowPurchaseReturns  Boolean  @default(true)
  allowSaleReturns      Boolean  @default(true)
  defaultCreditTerms    Int      @default(30)  // days
  creditLimitWarning    Float    @default(80)  // percentage
  organization          Organization @relation(fields: [organizationId], references: [id])
}
```

### Modified Customer Model

```prisma
model Customer {
  // ... existing fields ...
  gstNumber             String?
  creditTerms           Int      @default(30)  // override org default
  currentCredit         Float    @default(0)
}
```

### Modified Sale Model

```prisma
model Sale {
  // ... existing fields ...
  dueDate               DateTime?
  isOverdue             Boolean  @default(false)
  creditTerms           Int      @default(30)
}
```

## Implementation Steps

### 1. Schema migration
- Add `OrganizationSettings` model
- Add `gstNumber`, `creditTerms`, `currentCredit` to Customer
- Add `dueDate`, `isOverdue`, `creditTerms` to Sale
- Create migration

### 2. Express endpoints
- `GET /api/settings/organization` — get org settings
- `PUT /api/settings/organization` — update org settings (return policy, credit terms)
- `GET /api/customers/:id/credit` — get customer credit info
- `GET /api/sales/overdue` — list overdue sales
- `POST /api/sales/:id/mark-overdue` — mark sale as overdue

### 3. Service layer
- `getOverdueSales(orgId)` — find sales past due date
- `updateCustomerCredit(customerId, amount)` — update customer's current credit
- `checkCreditLimit(customerId, amount)` — verify credit limit not exceeded

### 4. React UI
- `apps/web/src/pages/settings/ReturnPolicy.tsx` — return policy settings
- `apps/web/src/pages/settings/CreditTerms.tsx` — credit terms settings
- Customer form: add GST number field
- Customer list: show credit info and overdue status
- Sale invoice form: show due date based on credit terms
- Dashboard: add "Overdue Payments" card

## Verification

- Return policy settings can be configured
- Customer GST number is saved and displayed
- Credit terms are applied to new sales
- Overdue sales are correctly identified
- Credit limit warnings work
- Due dates are calculated from credit terms
