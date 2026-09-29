# Checkpoint 2i — Brand API: Plan

## Goal

Create Express router for brands.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/brands` | List brands (paginated) |
| GET | `/api/brands/:id` | Get single brand |
| POST | `/api/brands` | Create brand |
| PUT | `/api/brands/:id` | Update brand |
| DELETE | `/api/brands/:id` | Delete brand |

## Implementation

### Route: `apps/server/src/routes/brand.ts`

Standard CRUD with pagination. Org scoping. The `organizationId` comes from auth middleware, not form data.

## Intentional Deviations

1. **Pagination added** — was unpaginated
2. **Org ID from auth** — original took `organizationId` from form data; Express version gets it from auth middleware (more secure)
