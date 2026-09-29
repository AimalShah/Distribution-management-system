import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { PurchaseReportQuery } from "@dms/shared";

const purchaseWindow = (
  organizationId: string,
  { startDate, endDate }: PurchaseReportQuery
): Prisma.PurchaseWhereInput => ({
  organizationId,
  ...(startDate || endDate
    ? {
        purchaseDate: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      }
    : {}),
});

/**
 * Header totals for the window.
 *
 * `totalItems` in the legacy was `purchases.reduce((sum, p) => sum +
 * p.purchaseItems.length, 0)` — a count of order *lines*, reported as
 * "totalItems" next to a quantity. A reader takes that for units bought, and a
 * single line for 500 units counts as one. It is renamed `totalLineItems` and
 * the unit count is reported separately as `totalQuantity`.
 *
 * Getting the unit count means reading the lines, so it is one grouped sum over
 * `PurchaseItem` rather than the legacy's `include: { purchaseItems: true }`,
 * which loaded every column of every line of every purchase in the window to
 * count them.
 */
export async function getBasicPurchaseReport(
  organizationId: string,
  query: PurchaseReportQuery
) {
  const [purchases, quantities] = await Promise.all([
    prisma.purchase.findMany({
      where: purchaseWindow(organizationId, query),
      select: {
        id: true,
        purchaseCode: true,
        purchaseDate: true,
        totalAmount: true,
        status: true,
        supplierId: true,
      },
      orderBy: { purchaseDate: "asc" },
    }),
    prisma.purchaseItem.groupBy({
      by: ["purchaseId"],
      _sum: { quantity: true },
      where: { purchase: purchaseWindow(organizationId, query) },
    }),
  ]);

  const totalQuantity = quantities.reduce(
    (sum, group) => sum + (group._sum.quantity ?? 0),
    0
  );

  const dailyTotals = new Map<string, number>();
  const byStatus = new Map<string, { orders: number; totalAmount: number }>();

  for (const purchase of purchases) {
    // `purchaseDate` is a `timestamp(3)` with no zone, so Prisma hands back a
    // Date whose UTC fields are the stored calendar date. `toISOString()` reads
    // the day back out rather than shifting it, and a "daily total" bucket is
    // the day the entry was made on.
    const day = purchase.purchaseDate.toISOString().slice(0, 10);
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + purchase.totalAmount);

    const status = purchase.status || "Unspecified";
    const bucket = byStatus.get(status) ?? { orders: 0, totalAmount: 0 };
    bucket.orders += 1;
    bucket.totalAmount += purchase.totalAmount;
    byStatus.set(status, bucket);
  }

  return {
    totalPurchaseAmount: purchases.reduce(
      (sum, p) => sum + p.totalAmount,
      0
    ),
    totalOrders: purchases.length,
    uniqueSuppliers: new Set(purchases.map((p) => p.supplierId)).size,
    totalLineItems: quantities.length,
    totalQuantity,
    // Sorted rather than left in insertion order. The legacy built a plain object
    // and returned `Object.entries` of it, which happened to be chronological
    // only because the query sorted by date; the ordering was a side effect of
    // something else and would have inverted the moment that sort changed.
    dailyTotals: [...dailyTotals.entries()]
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    // `status` is a free-text column with a comment reading "e.g. 'Pending',
    // 'Completed'", and no report applied a filter on it, so pending orders were
    // added into the same "total purchase amount" as completed ones. Rather than
    // pick a status and hide the other, the split is reported: the total is
    // still the total, and a reader can see what it is made of.
    byStatus: [...byStatus.entries()]
      .map(([status, bucket]) => ({ status, ...bucket }))
      .sort((a, b) => a.status.localeCompare(b.status)),
  };
}

/**
 * Spend per supplier.
 *
 * The legacy accumulated into an object keyed on `p.supplier?.companyName`, so
 * two suppliers sharing a company name became one row with their spend added
 * together — and a supplier actually named "Unknown Supplier" merged with the
 * null bucket, since that was the fallback string. `Purchase.supplierId` is
 * non-nullable and the relation is required, so the fallback could never fire;
 * the name is only ever a display field now, and `supplierId` is the key.
 */
export async function getPurchaseBySupplier(
  organizationId: string,
  query: PurchaseReportQuery
) {
  const purchases = await prisma.purchase.findMany({
    where: purchaseWindow(organizationId, query),
    select: {
      supplierId: true,
      totalAmount: true,
      supplier: { select: { companyName: true } },
    },
  });

  const totals = new Map<
    string,
    { companyName: string; orders: number; totalAmount: number }
  >();

  for (const purchase of purchases) {
    const bucket = totals.get(purchase.supplierId) ?? {
      companyName: purchase.supplier.companyName,
      orders: 0,
      totalAmount: 0,
    };
    bucket.orders += 1;
    bucket.totalAmount += purchase.totalAmount;
    totals.set(purchase.supplierId, bucket);
  }

  return [...totals.entries()]
    .map(([supplierId, bucket]) => ({ supplierId, ...bucket }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Spend per product.
 *
 * Same name-keyed accumulator as the supplier report, with the same collision:
 * two products sharing a name merged into one line. Keyed on `productId` here.
 *
 * Quantity and average unit cost come along because a spend figure alone cannot
 * distinguish buying 1 at 100 from buying 100 at 1, and those two want opposite
 * decisions.
 */
export async function getPurchaseByProduct(
  organizationId: string,
  query: PurchaseReportQuery
) {
  const items = await prisma.purchaseItem.findMany({
    where: { purchase: purchaseWindow(organizationId, query) },
    select: {
      productId: true,
      quantity: true,
      unitCost: true,
      totalCost: true,
      product: { select: { name: true, productCode: true, unit: true } },
    },
  });

  const totals = new Map<
    string,
    {
      name: string;
      productCode: string;
      unit: string;
      quantity: number;
      totalCost: number;
      costSum: number;
      costCount: number;
    }
  >();

  for (const item of items) {
    const bucket = totals.get(item.productId) ?? {
      name: item.product.name,
      productCode: item.product.productCode,
      unit: item.product.unit,
      quantity: 0,
      totalCost: 0,
      costSum: 0,
      costCount: 0,
    };
    bucket.quantity += item.quantity;
    bucket.totalCost += item.totalCost;
    bucket.costSum += item.unitCost;
    bucket.costCount += 1;
    totals.set(item.productId, bucket);
  }

  return [...totals.entries()]
    .map(([productId, bucket]) => ({
      productId,
      name: bucket.name,
      productCode: bucket.productCode,
      unit: bucket.unit,
      quantity: bucket.quantity,
      totalCost: bucket.totalCost,
      averageUnitCost:
        bucket.costCount > 0 ? bucket.costSum / bucket.costCount : 0,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

export async function getFullPurchaseReport(
  organizationId: string,
  query: PurchaseReportQuery
) {
  const [basic, bySupplier, byProduct] = await Promise.all([
    getBasicPurchaseReport(organizationId, query),
    getPurchaseBySupplier(organizationId, query),
    getPurchaseByProduct(organizationId, query),
  ]);

  return { basic, bySupplier, byProduct, generatedAt: new Date() };
}
