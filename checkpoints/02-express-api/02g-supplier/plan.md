# Checkpoint 2g — Supplier API: Plan

## Goal

Create Express router for suppliers.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/suppliers` | List suppliers (paginated) |
| GET | `/api/suppliers/:id` | Get single supplier |
| POST | `/api/suppliers` | Create supplier |
| PUT | `/api/suppliers/:id` | Update supplier |
| DELETE | `/api/suppliers/:id` | Delete supplier |

## Implementation

### Route: `apps/server/src/routes/supplier.ts`

Standard CRUD with pagination on list endpoint. Org scoping on all queries.

## Intentional Deviations

1. **Pagination added** — was unpaginated
2. **Auth middleware** — replaces session-based org lookup
