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
  // Aggregated in the database rather than by pulling every matching purchase into
  // this process: the response has one line per supplier, but the old `findMany`
  // had one row per purchase across the whole window, joined to `Supplier` on each.
  const groups = await prisma.purchase.groupBy({
    by: ["supplierId"],
    where: purchaseWindow(organizationId, query),
    _count: { _all: true },
    _sum: { totalAmount: true },
    orderBy: { _sum: { totalAmount: "desc" } },
  });

  const suppliers = await prisma.supplier.findMany({
    where: {
      organizationId,
      id: { in: groups.map((group) => group.supplierId) },
    },
    select: { id: true, companyName: true },
  });
  const byId = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

  // `Purchase.supplierId` is a required relation, so a group always resolves. The
  // filter is here so a dangling row drops one line rather than throwing.
  return groups.flatMap((group) => {
    const supplier = byId.get(group.supplierId);
    if (!supplier) return [];

    return [
      {
        supplierId: group.supplierId,
        companyName: supplier.companyName,
        orders: group._count._all,
        totalAmount: group._sum.totalAmount ?? 0,
      },
    ];
  });
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
  // Aggregated in the database, as the supplier report above is: the response has
  // one line per product, the old `findMany` had one row per purchase line in the
  // window.
  //
  // The average unit cost is the mean of `unitCost` across the lines, not
  // spend-weighted -- the number the loop produced, preserved here.
  const groups = await prisma.purchaseItem.groupBy({
    by: ["productId"],
    where: { purchase: purchaseWindow(organizationId, query) },
    _count: { _all: true },
    _sum: { quantity: true, totalCost: true, unitCost: true },
    orderBy: { _sum: { totalCost: "desc" } },
  });

  const products = await prisma.product.findMany({
    where: {
      organizationId,
      id: { in: groups.map((group) => group.productId) },
    },
    select: { id: true, name: true, productCode: true, unit: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  // `PurchaseItem.productId` is a required relation, so a group always resolves.
  // The filter is here so a dangling row drops one line rather than throwing.
  return groups.flatMap((group) => {
    const product = byId.get(group.productId);
    if (!product) return [];

    const lineCount = group._count._all;
    const costSum = group._sum.unitCost ?? 0;

    return [
      {
        productId: group.productId,
        name: product.name,
        productCode: product.productCode,
        unit: product.unit,
        quantity: group._sum.quantity ?? 0,
        totalCost: group._sum.totalCost ?? 0,
        averageUnitCost: lineCount > 0 ? costSum / lineCount : 0,
      },
    ];
  });
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
