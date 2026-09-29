# Checkpoint 2h — Category API: Source Review

## Source Review: `src/actions/category.ts` + `src/services/category.ts`

### Exported Functions

#### `createCategory(data: CategoryFormData)`
- **Input:** CategoryFormData (name, description?)
- **Validation:** CategorySchema (Zod)
- **Side effects:** Creates Category record with org ID from session
- **Returns:** Created category

#### `fetchCategories()`
- **Input:** None (uses session org ID)
- **Returns:** Array of categories with brands relation
- **Note:** Unpaginated

#### `fetchCategory(id: string)`
- **Input:** Category ID
- **Returns:** Single category

#### `editCategory(id: string, data: CategoryFormData)`
- **Input:** Category ID + data
- **Side effects:** Updates category record
- **Returns:** Updated category

#### `removeCategory(id: string)`
- **Input:** Category ID
- **Side effects:** Deletes category record
- **Returns:** Deleted category

### Service Layer

- `addCategory(data, orgId)` — creates category with organizationId
- `getCategorys(orgId)` — fetches categories with brands (note: typo in function name)
- `getCatgoryById(id)` — fetches single category (note: typo in function name)
- `updateCategory(id, data)` — updates category
- `deleteCategory(id)` — deletes category

### Bugs/Assumptions

1. Function name typos: `getCategorys`, `getCatgoryById` — Express version should use correct names
2. Category has unique constraint on `name + organizationId`
