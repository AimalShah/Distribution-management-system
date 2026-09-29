# Checkpoint 2i — Brand API: Source Review

## Source Review: `src/actions/brand.ts` + `src/services/brand.ts`

### Exported Functions

#### `createBrand(data: BrandFormData)`
- **Input:** BrandFormData (organizationId, name, description?)
- **Validation:** BrandSchema (Zod)
- **Side effects:** Creates Brand record
- **Returns:** Created brand
- **Revalidates:** `/product`

#### `fetchBrands()`
- **Input:** None (uses session org ID)
- **Returns:** Array of brands
- **Note:** Unpaginated

#### `fetchBrand(id: string)`
- **Input:** Brand ID
- **Returns:** Single brand

#### `editBrand(id: string, data: BrandFormData)`
- **Input:** Brand ID + data
- **Side effects:** Updates brand record
- **Returns:** Updated brand

#### `removeBrand(id: string)`
- **Input:** Brand ID
- **Side effects:** Deletes brand record
- **Returns:** Deleted brand

### Service Layer

- `addBrand(data)` — creates brand
- `getBrands()` — fetches brands for current org
- `getBrandById(id)` — fetches single brand
- `updateBrand(id, data)` — updates brand
- `deleteBrand(id)` — deletes brand

### Bugs/Assumptions

1. Brand has unique constraint on `name + categoryId + organizationId`
2. Brand creation requires `organizationId` in the form data (not from session)
