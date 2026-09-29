# Checkpoint 2h — Category API: Plan

## Goal

Create Express router for categories.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` | List categories (paginated) |
| GET | `/api/categories/:id` | Get single category |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |

## Implementation

### Route: `apps/server/src/routes/category.ts`

Standard CRUD with pagination. Org scoping. Unique constraint on name+org handled by Prisma.

## Intentional Deviations

1. **Pagination added** — was unpaginated
2. **Correct naming** — Express uses `getCategories` not `getCategorys`
