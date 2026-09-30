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

## Deviations From This Plan (as built)

### The three reports had no tenant scope at all

`getBasicPurchaseReport`, `getPurchaseBySupplier` and `getPurchaseByProduct` in
`src/services/reports/purchaseReport.ts` each took `(startDate, endDate)` and
nothing else. Not one filters on an organization, though `Purchase` carries
`organizationId` directly. Every caller got every tenant's spend, supplier
names and purchase lines.

Fixed in all three, plus `full`. `PurchaseItem` has no `organizationId` column
and reaches its tenant through `purchase`, which is where the by-product report
and the line-count sum put it.

### Grouped by name, so two of anything collapsed into one

Both grouping reports accumulated into a plain object keyed on a display string:

```ts
const name = p.supplier?.companyName || "Unknown Supplier";
acc[name] = (acc[name] || 0) + p.totalAmount;
```

Two suppliers trading under the same company name came back as one row with
their spend added together — a spend-per-supplier report that is not per
supplier. Same for `getPurchaseByProduct` on `item.product?.name`.

There is a second collision in the supplier version: the fallback string is
itself a key, so a supplier genuinely named "Unknown Supplier" merges with the
null bucket. That bucket could never fill — `Purchase.supplierId` is
non-nullable and the `supplier` relation is required — so `p.supplier` is never
null and the `?.` and the fallback are dead code.

Now keyed on `supplierId` and `productId`, with the name as a field beside the
total. Each row also carries its order count, and the product report carries
quantity and average unit cost: a spend figure alone cannot distinguish buying 1
at 100 from buying 100 at 1, and those two want opposite decisions.

### `totalItems` was a count of order lines

```ts
const totalItems = purchases.reduce((sum, p) => sum + p.purchaseItems.length, 0);
```

Reported as "items" next to a quantity, so it reads as units bought. One line
for 500 units counts as one, and one unit bought 500 times counts as 500. It is
renamed `totalLineItems`, and the unit count is now reported as `totalQuantity`,
from a grouped sum over `PurchaseItem` rather than the legacy's
`include: { purchaseItems: true }` — which loaded every column of every line of
every purchase in the window in order to count them.

### Pending orders were added into the same total as completed ones

`status` is a free-text `String` with the comment `// e.g. 'Pending',
'Completed'`, nothing defaults it, and no report filtered on it. A pending
purchase order is an intent; it was summed into `totalPurchaseAmount` beside
orders that had actually landed, with nothing on the response to tell the reader
which was which.

Rather than pick a status and hide the other, the report now carries a `byStatus`
breakdown. The total is still the total, and a reader can see what it is made
of. An empty status becomes `"Unspecified"` rather than an empty-string row,
since the column is nullable in practice.

### Daily totals were left in insertion order

The legacy built `dailyTotals` as a plain object and returned
`Object.entries(dailyTotals).map(...)`. It came out chronological only because
the query sorted by `purchaseDate` — the ordering was a side effect of something
else, and the moment that sort changed the chart went backwards. Now sorted
explicitly.

The day itself is `purchaseDate.toISOString().slice(0, 10)`, kept. `purchaseDate`
is a `timestamp(3)` with no zone, so Prisma returns a `Date` whose UTC fields are
the stored calendar date and `toISOString()` reads that day back out rather than
shifting it. Buckets are the day the entry was made on, not a timezone-converted
day.

### Date validation, as the plan's deviation 2, where the legacy failure was silent

`startDate` and `endDate` were required parameters, and a caller omitting them
got `new Date(undefined)` — an `Invalid Date` — compared against `purchaseDate`,
where every `purchaseDate >= Invalid Date` is `false`. The report came back
empty and read as a tenant that bought nothing. A reversed range did the same
thing and was never checked.

Now shared with checkpoint 2m rather than written again:
`reportRangeQuerySchema` in `packages/shared/src/schemas/report.ts`, coerced,
both bounds optional, one bound allowed on its own, and `superRefine` rejecting
a reversed range.

### Also

1. **A null `_sum.quantity` no longer poisons the total.** A purchase whose lines
   all carry a null quantity is reachable, and `sum + null` is `NaN` — which
   serialises to `null` in JSON and takes the whole figure with it.

2. **Rows are ordered.** Both grouping reports sort by spend, highest first,
   since "what do we spend with whom" is read top-down.

3. **Only the columns needed are read.** The legacy used
   `include: { supplier: true }` and `include: { product: true }`, loading whole
   supplier and product rows — including address, contact and timestamps — to
   read one string off each. Now nested `select`s.
