# Checkpoint 2a — Product API: Source Review

## Source Review: `src/actions/product.ts` + `src/services/product.ts`

### Exported Functions

#### `createProduct(data: ProductFormData)`
- **Input:** ProductFormData (name, productCode, category, unit, brand, description?, unitCost, unitPrice, isActive)
- **Validation:** ProductSchema (Zod) — name min 2, productCode min 3, unitCost/unitPrice string→number transform
- **Side effects:** Creates Product record in DB
- **Returns:** Created product object
- **Revalidates:** None

#### `fetchProducts()`
- **Input:** None (uses session to get org ID)
- **Validation:** None
- **Side effects:** None
- **Returns:** Array of products with category, brand, inventory relations
- **Note:** Returns ALL products for the org — no pagination

#### `editProduct(id: string, data: Partial<ProductFormData>)`
- **Input:** Product ID + partial product data
- **Validation:** ProductSchema.partial()
- **Side effects:** Updates Product record
- **Returns:** Updated product object

#### `removeProduct(id: string)`
- **Input:** Product ID
- **Validation:** None
- **Side effects:** Deletes Product record
- **Returns:** Deleted product object

### Service Layer (`src/services/product.ts`)

- `addProduct(data, orgId)` — creates product with organizationId
- `getProducts(orgId)` — fetches products with category, brand, inventory relations
- `updateProduct(id, data, orgId)` — updates product scoped to org
- `deleteProduct(id)` — deletes product

### Types

```typescript
type ProductFormData = {
  name: string;
  productCode: string;
  category: string;
  unit: string;
  brand: string;
  description?: string;
  unitCost: number;
  unitPrice: number;
  isActive: boolean;
};
```

### Bugs/Assumptions Noted

1. `fetchProducts()` returns unpaginated array — will need pagination in Express version
2. No explicit org check on `editProduct`/`removeProduct` — relies on service layer scoping
3. `unitCost`/`unitPrice` are transformed from string to number in the Zod schema — the Express API should accept both
