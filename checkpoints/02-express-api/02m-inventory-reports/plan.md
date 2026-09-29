# Checkpoint 2m — Inventory Reports API: Plan

## Goal

Create Express router for inventory reports.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/inventory/basic` | Basic inventory report |
| GET | `/api/reports/inventory/movements` | Inventory movements |
| GET | `/api/reports/inventory/low-stock` | Low stock report |
| GET | `/api/reports/inventory/stock-valuation` | Stock valuation |
| GET | `/api/reports/inventory/expiry` | Expiry report |
| GET | `/api/reports/inventory/full` | All reports combined |

## Implementation

### Route: `apps/server/src/routes/reports/inventory.ts`

All endpoints accept `startDate` and `endDate` query params. Org scoping via auth middleware.

## Intentional Deviations

1. **Org scoping** — some original report functions didn't scope by org; Express version does
2. **Date validation** — Express version validates date format
