# Checkpoint 2n — Purchase Reports API: Plan

## Goal

Create Express router for purchase reports.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/purchase/basic` | Basic purchase report |
| GET | `/api/reports/purchase/by-supplier` | Purchases by supplier |
| GET | `/api/reports/purchase/by-product` | Purchases by product |
| GET | `/api/reports/purchase/full` | All reports combined |

## Implementation

### Route: `apps/server/src/routes/reports/purchase.ts`

Date range via query params. Org scoping via auth middleware.
