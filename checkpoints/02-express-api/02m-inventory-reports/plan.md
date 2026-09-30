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

## Deviations From This Plan (as built)

### The legacy reports had no tenant scope at all

`getBasicInventoryReport`, `getStockValuationReport`, `getInventoryMovements`,
`getLowStockReport` and `getExpiryReport` in
`src/services/reports/inventoryReport.ts` each took `(startDate, endDate)` and
nothing else. Not one of the five queries filters on an organization. Every
caller received every tenant's stock, movements, low-stock list, purchase history
and supplier names.

This is the deviation the plan names, and it is fixed in all five. `Inventory` and
`Product` carry `organizationId`; `InventoryLog` and `PurchaseItem` do not, so
their filters go through the `inventory` and `purchase` relations. There is a test
per report asserting the tenant reaches the query.

### `totalQuantity` was a sum of magnitudes, not a quantity

This is the substantive one, and it changes what the report *means*.

The legacy basic report did:

```ts
const movements = await prisma.inventoryLog.groupBy({
  by: ["productId"],
  _sum: { quantity: true },
  where: { createdAt: { gte: new Date(startDate), lte: new Date(endDate) } },
})
```

and reported `_sum.quantity` as `totalQuantity`. `InventoryLog.quantity` is a
**magnitude** for every directional movement — the direction is in
`movementType`, so an `OUT` of 4 stores `quantity: 4` — and is signed only for
`ADJUSTMENT`. Checkpoint 2d wrote those rows and its test pins it.

So the sum rises when goods arrive *and* when they leave. A product that
received 100 and shipped 100 scores 200. It is not quantity on hand and it is not
net movement, and no choice of dates makes it either.

`getStockValuationReport` was built on that figure — `totalValue = totalQuantity *
averageUnitCost` — so the "stock valuation" was a count of units *handled*,
priced as though they were units *held*.

As built:

- `quantityOnHand` comes from the `Inventory` row, and means what it says.
- `netMovementInPeriod` is the signed movement in the window: increases minus
  decreases, plus signed adjustments. Computed as three grouped sums rather than
  one plus a `switch` in JavaScript, so the arithmetic happens in the database
  and no log rows are loaded to do it.
- `netMovementInPeriod` is `null` when no window was sent, so "nothing moved in
  this period" is distinguishable from "no period was asked about".
- `totalValue` is `quantityOnHand * averageUnitCost`.

### Also corrected

1. **A product that never moved is missing from the "basic inventory report".**
   The legacy built the report from the movements, collected `productIds` from
   them, and read inventory for those products only. Anything sitting still since
   its last delivery — which is most of a distributor's catalogue — was absent
   from the report of what it holds. The base is now the tenant's inventory rows.

2. **The low-stock report never stopped.** `Inventory.reorderLevel` is
   `@default(0)` and the filter was `quantityOnHand <= reorderLevel`, so every
   product created without an explicit level appeared forever: zero on hand, at
   or below a reorder level of zero, never having been below anything. A reorder
   level of zero means "do not reorder this". Added `reorderLevel > 0`.

3. **`daysUntilExpiry` never did anything.** The legacy guarded it with
   `Number.isFinite(daysUntilExpiry)`, and a query parameter is always a string,
   and `Number.isFinite("30")` is `false` — so the threshold silently fell back
   to the end of the window for every caller that reached it over HTTP. Now
   coerced, and bounded to a non-negative integer of at most 3650 days.

4. **The expiry threshold was measured from the wrong end.** `expiryLimit =
   windowEnd + daysUntilExpiry * MS_PER_DAY`, so "expires within 30 days" meant
   30 days after the end of the reporting period. With a window ending today that
   happens to coincide; with any other window it answers a different question.
   Measured from `now`.

5. **The expiry report has no lower bound unless one is asked for.** The legacy
   defaulted `windowStart` to `new Date(0)`, which requests every purchase line
   ever written. Now `null`, which Prisma treats as no bound.

6. **Date validation, as the plan says — and the legacy's failure mode was
   silent.** `startDate` and `endDate` were required parameters, and a caller
   omitting them got `new Date(undefined)`, an `Invalid Date`, into a comparison
   where every `createdAt >= Invalid Date` is `false`. The report came back empty
   and read as "this tenant has no stock". `z.coerce.date()` rejects an
   unparseable value, both are optional (two of the five reports are about the
   present, not a period), and `superRefine` rejects a reversed range — which the
   legacy also did not check, for the same silent-empty reason.

7. **The movement log now carries its opening and closing figures, and who
   moved it.** `previousQty` and `newQty` are on every row and were omitted;
   `quantity` alone says 4 units moved and not whether that was out of 100 or out
   of 5.

8. **`getFullInventoryReports` is scoped too.** It is the one that fans out to
   all five, so it is the one where a single missing filter publishes everything.

### Not fixed, and not fixable here

**The expiry report is a report about what was bought.** Expiry lives on
`PurchaseItem` and nowhere else — there is no batch or stock-by-expiry table — so
there is no way to ask how much of a batch is *still on hand*. A batch of 40 that
sold in full still appears, with `quantity: 40`, as though 40 units were about to
expire. The row is named `purchasedQuantity` for that reason, and carries the
product's `quantityOnHand` beside it for context, but the honest answer needs a
stock-by-batch model that does not exist.

**Stock valuation uses a blended cost.** The basis is the average unit cost
across the tenant's purchase history, so a case bought at 3.00 and a pallet at
40.00 produce one number, which understates what remains if the cheap stock sold
first. Weighted average needs a running balance the schema does not keep.
