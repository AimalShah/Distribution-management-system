# Checkpoint 2o — Sales Reports API: Plan

## Goal

Create Express router for sales reports.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/sales/basic` | Basic sales report |
| GET | `/api/reports/sales/by-customer` | Sales by customer |
| GET | `/api/reports/sales/by-product` | Sales by product |
| GET | `/api/reports/sales/full` | All reports combined |

## Implementation

### Route: `apps/server/src/routes/reports/sales.ts`

Date range via query params. Org scoping via auth middleware.
