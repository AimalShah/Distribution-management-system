# Checkpoint 2f — Customer API: Plan

## Goal

Create Express router for customers.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/customers` | List customers (paginated) |
| GET | `/api/customers/:id` | Get single customer |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Delete customer |

## Implementation

### Route: `apps/server/src/routes/customer.ts`

Standard CRUD with pagination on list endpoint. Org scoping on all queries. Auth middleware provides `req.auth.organizationId`.

## Intentional Deviations

1. **Pagination added** — was unpaginated
2. **Auth middleware** — replaces session-based org lookup
3. **No revalidate** — frontend uses SWR mutation instead
