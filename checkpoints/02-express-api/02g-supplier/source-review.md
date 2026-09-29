# Checkpoint 2g — Supplier API: Source Review

## Source Review: `src/actions/supplier.ts` + `src/services/supplier.ts`

### Exported Functions

#### `createSupplier(data: SupplierFormData)`
- **Input:** SupplierFormData (supplierCode, companyName, contactPerson, email?, phone, address, city, isActive)
- **Validation:** SupplierSchema (Zod)
- **Side effects:** Creates Supplier record
- **Returns:** Created supplier

#### `fetchSuppliers()`
- **Input:** None (uses session org ID)
- **Returns:** Array of suppliers with purchases relation
- **Note:** Unpaginated

#### `editSupplier(id: string, data: Partial<SupplierFormData>)`
- **Input:** Supplier ID + partial data
- **Side effects:** Updates supplier record
- **Returns:** Updated supplier

#### `removeSupplier(id: string)`
- **Input:** Supplier ID
- **Side effects:** Deletes supplier record
- **Returns:** Deleted supplier

### Service Layer

- `addSupplier(data, orgId)` — creates supplier with organizationId
- `getSuppliers(orgId)` — fetches suppliers with purchases
- `updateSupplier(id, data)` — updates supplier
- `deleteSupplier(id)` — deletes supplier

### Bugs/Assumptions

1. No org check on update/delete — relies on service layer
2. `isActive` defaults to true in schema
