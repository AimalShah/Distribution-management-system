# Checkpoint 2e — Return API: Source Review

## Source Review: `src/actions/return.ts` + `src/services/return.ts`

### Exported Functions

#### `createReturn(data: ReturnFormData)`
- **Input:** ReturnFormData (returnCode, returnType, returnDate, reason?, items[], saleId?, customerId?, purchaseId?)
- **Validation:** ReturnFormSchema (Zod) — SALE returns require saleId, PURCHASE returns require purchaseId
- **Side effects:**
  - Creates Return record
  - Creates ReturnItem records
  - For SALE returns: updates inventory (IN movement) — items come back
  - For PURCHASE returns: updates inventory (OUT movement) — items go back to supplier
  - Creates InventoryLog entries
- **Returns:** Created return with items

#### `fetchReturns()`
- **Input:** None (uses session org ID)
- **Returns:** Array of returns with items + user
- **Note:** Unpaginated

#### `fetchReturn(id: string)`
- **Input:** Return ID
- **Returns:** Single return with items

#### `editReturn(id: string, data: Partial<ReturnFormData>)`
- **Input:** Return ID + partial data
- **Side effects:** Updates return record
- **Returns:** Updated return

#### `removeReturn(id: string)`
- **Input:** Return ID
- **Side effects:** Deletes return record
- **Returns:** Deleted return

### Service Layer

- `addReturn(data, orgId, userId)` — creates return + items + inventory updates
- `getReturns(orgId)` — fetches with items + user
- `getReturnById(id)` — fetches single return
- `updateReturn(id, data)` — updates return
- `deleteReturn(id)` — deletes return

### Bugs/Assumptions

1. Return type determines inventory direction — SALE returns add stock back, PURCHASE returns remove stock
2. No transaction wrapping — partial failure could leave inconsistent state
3. EXPIRED/DAMAGED return types don't seem to trigger inventory changes in the service layer (only SALE/PURCHASE do)
