# Checkpoint 4h — Supplier Page: Source Review

## Source Review: `src/app/(app)/supplier/page.tsx` + `src/components/supplier/SupplierForm.tsx`

### Page: `src/app/(app)/supplier/page.tsx`

**Data fetched:**
- Suppliers list (all suppliers for current org)

**Features:**
- Table with supplier list
- Add/edit/delete supplier dialog
- Shows supplier code, company name, contact person, phone

### Components

#### `SupplierForm.tsx`
- SupplierDialog for add/edit
- Fields: supplierCode, companyName, contactPerson, email, phone, address, city, isActive

### Bugs/Assumptions

1. Supplier list is not paginated
