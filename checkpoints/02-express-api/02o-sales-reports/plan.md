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

## Deviations From This Plan (as built)

### The three reports had no tenant scope at all

`getBasicSalesReport`, `getSalesByCustomer` and `getSalesByProduct` in
`src/services/reports/salesReport.ts` each took `(startDate, endDate)` and
nothing else. Not one filters on an organization, though `Sale` carries
`organizationId` directly. Every caller got every tenant's revenue, customer
names and invoice lines — and `Customer` carries `email`, `phone` and `address`,
so the by-customer report was a cross-tenant contact list.

Fixed in all three, plus `full`. `SaleItem` has no `organizationId` column and
reaches its tenant through `sale`, which is where the by-product report and both
line sums put it.

### Neither grouping report was grouped

Both accumulated into a plain object keyed on a display string:

```ts
const name = sale.customer?.name || "Unknown Customer";
acc[name] = (acc[name] || 0) + sale.totalAmount;
```

Two customers sharing a name came back as one row with their revenue added
together — from a report whose job is revenue per customer. Same for
`getSalesByProduct` on `item.product?.name`, where the fallback is
`"Unnamed Product"`.

The customer version has a second collision: the fallback string is itself a
key, so a customer genuinely named "Unknown Customer" merges with the null
bucket. That bucket could never fill — `Sale.customerId` is non-nullable and the
`customer` relation is required, so `sale.customer` is never null and the `?.`
and the fallback are dead code.

Now keyed on `customerId` and `productId`, name beside the total. Rows carry an
order count, the customer's code and `isActive`, and the product report carries
quantity and average unit price — a revenue figure alone cannot distinguish
selling 1 at 1000 from selling 1000 at 1, and those want opposite decisions.

### The by-customer report loaded the entire invoice to read one name

```ts
include: { items: { include: { product: true } }, customer: true },
```

and the body then read neither `items` nor anything off `customer` except
`.name`. Every line of every invoice in the window, and every full product row
behind every line, was loaded and discarded. Now a nested `select` of three
columns, with a test asserting the shape so it does not creep back.

### `totalSales` is a header figure nothing ever checked

`Sale.totalAmount` is written straight from the request body by
`createInvoice` in `src/services/saleInvoice.ts`:

```ts
totalAmount: data.totalAmount,
```

It is never recomputed from the lines, and there is no constraint tying it to
them. So an invoice's header can disagree with its own invoice by any amount, and
`totalSales` — a sum of those headers — reported the disagreement as revenue.
The line subtotal was never computed at all, so nothing on the response could
reveal it.

The report now computes both: `totalSales` is still the sum of the headers, so
nothing that consumed the report changes meaning, and beside it are
`totalLineSubtotal` and `unreconciledOrders` — how many invoices in the window
have a header that differs from their own lines by more than half a cent. Which
figure is correct is not a question this layer can answer, so both are reported
and the count says how far apart they are. A sale with no lines is not counted
as unreconciled; it has nothing to disagree with.

### `totalItems` was a count of invoice lines

```ts
const totalItems = sales.reduce((sum, sale) => sum + sale.items.length, 0);
```

Reported as "items" beside a quantity, so it reads as units sold. One line for
500 units counts as one; one unit sold 500 times counts as 500. Renamed
`totalLineItems`, and the unit count is now `totalQuantity`, from a grouped sum
over `SaleItem` rather than the legacy's `include: { items: true }` — which
loaded every column of every line of every sale in the window to count them.

### Pending invoices were added into the same total as completed ones

`status` is a free-text `String` with the comment `// 'Pending', 'Completed'`,
nothing defaults it, and no report filtered on it. A pending invoice is an
intent; it was summed into `totalSales` beside invoices that had actually been
issued, with nothing on the response to say which was which.

Rather than pick a status and hide the other, the report carries a `byStatus`
breakdown. The total is still the total, and a reader can see what it is made
of. An empty status becomes `"Unspecified"` rather than an empty-string row,
since the column is nullable in practice.

### Date validation, as the plan's deviation 2, where the legacy failure was silent

`startDate` and `endDate` were required parameters, and a caller omitting them
got `new Date(undefined)` — an `Invalid Date` — compared against `saleDate`,
where every `saleDate >= Invalid Date` is `false`. The report came back empty
and read as a tenant that sold nothing. A reversed range did the same thing and
was never checked.

Now shared with checkpoints 2m and 2n rather than written a third time:
`reportRangeQuerySchema` in `packages/shared/src/schemas/report.ts` — coerced,
both bounds optional, either bound alone allowed, reversed range rejected.

### Also

1. **A null line quantity no longer poisons the total.**
   `sum + (group._sum.quantity ?? 0)` — a null is reachable on both the quantity
   and the subtotal sum, and `NaN` serialises to `null` in JSON and takes the
   figure with it.

2. **Daily totals are sorted.** The legacy returned `Object.entries(dailyTotals)`,
   chronological only because the query sorted by `saleDate`; the ordering was a
   side effect of something else and would have inverted the moment that sort
   changed. The day bucket itself is unchanged: `saleDate` is a `timestamp(3)`
   with no zone, so `toISOString()` reads the stored calendar day back out
   rather than shifting it.

3. **Only the columns needed are read**, and grouping rows are ordered by
   revenue, highest first, since "who do we sell to" is read top-down.
