# Checkpoint 2f — Customer API: Source Review

## Source Review: `src/actions/customer.ts` + `src/services/customer.ts`

### Exported Functions

#### `createCustomer(data: CustomerFormData)`
- **Input:** CustomerFormData (customerCode, name, email?, phone?, address?, city?, creditLimit, isActive)
- **Validation:** CustomerSchema (Zod)
- **Side effects:** Creates Customer record
- **Returns:** Created customer
- **Revalidates:** `/customer`, `/invoices`

#### `fetchCustomers()`
- **Input:** None (uses session org ID)
- **Returns:** Array of customers with sales relation
- **Note:** Unpaginated

#### `fetchCustomer(id: string)`
- **Input:** Customer ID
- **Returns:** Single customer with sales

#### `editCustomer(id: string, data: Partial<CustomerFormData>)`
- **Input:** Customer ID + partial data
- **Side effects:** Updates customer record
- **Returns:** Updated customer

#### `removeCustomer(id: string)`
- **Input:** Customer ID
- **Side effects:** Deletes customer record
- **Returns:** Deleted customer

### Service Layer

- `addCustomer(data, orgId)` — creates customer with organizationId
- `getCustomers(orgId)` — fetches customers with sales
- `getCustomerById(id)` — fetches single customer with sales
- `updateCustomer(id, data)` — updates customer
- `deleteCustomer(id)` — deletes customer

### Bugs/Assumptions

1. `creditLimit` is transformed from string to number in Zod schema
2. No org check on update/delete — relies on service layer
