import prisma from "@dms/db";

const TOP_PRODUCTS = 5;
const RECENT_ACTIVITIES = 8;
const INVENTORY_LEVELS = 10;

/** First instant of the month `offset` months from `now`'s, in UTC. */
const monthStart = (now: Date, offset = 0) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));

/**
 * Month over month change as a percentage, one decimal place. `null` when last
 * month had nothing to compare against -- "+Infinity%" is not a number a
 * dashboard can show, and 0% would claim no change.
 */
export const trendPercent = (current: number, previous: number): number | null =>
  previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;

/**
 * Everything the dashboard shows apart from the sales chart, which reuses
 * `GET /reports/sales/basic`.
 *
 * The legacy page fetched every sale, purchase, product, customer and inventory
 * row the tenant had -- with every sale's lines -- and summed them in the
 * browser. Each figure here is an aggregate in the database instead, so the
 * cost no longer grows with the tenant's history.
 *
 * Two legacy figures were invented and are now computed:
 * - The sales and purchase "trend" cards were the constants `12.5` and `-2.3`.
 *   They are this calendar month against last month.
 * - Each top product's "+N%" was `Math.random()`. It is dropped; there is no
 *   honest number for it without a second window.
 *
 * "Top products" are this month's, which is what the legacy card's subtitle
 * ("Best performing products this month") claimed but did not do.
 */
export async function getDashboardStats(organizationId: string, now = new Date()) {
  const thisMonth = monthStart(now);
  const lastMonth = monthStart(now, -1);
  const sales = { organizationId };
  const purchases = { organizationId };

  const [
    salesTotal,
    purchasesTotal,
    customerCount,
    productCount,
    salesThisMonth,
    salesLastMonth,
    purchasesThisMonth,
    purchasesLastMonth,
    lowStockCount,
    topGroups,
    recentSales,
    recentPurchases,
    inventoryLevels,
  ] = await Promise.all([
    prisma.sale.aggregate({ where: sales, _sum: { totalAmount: true } }),
    prisma.purchase.aggregate({ where: purchases, _sum: { totalAmount: true } }),
    prisma.customer.count({ where: { organizationId } }),
    prisma.product.count({ where: { organizationId } }),
    prisma.sale.aggregate({
      where: { ...sales, saleDate: { gte: thisMonth } },
      _sum: { totalAmount: true },
    }),
    prisma.sale.aggregate({
      where: { ...sales, saleDate: { gte: lastMonth, lt: thisMonth } },
      _sum: { totalAmount: true },
    }),
    prisma.purchase.aggregate({
      where: { ...purchases, purchaseDate: { gte: thisMonth } },
      _sum: { totalAmount: true },
    }),
    prisma.purchase.aggregate({
      where: { ...purchases, purchaseDate: { gte: lastMonth, lt: thisMonth } },
      _sum: { totalAmount: true },
    }),
    // Same definition as `GET /inventory/low-stock`, so the alert's count and
    // the list it links to agree. The legacy treated a reorder level of 0 as 10.
    prisma.inventory.count({
      where: { organizationId, quantityOnHand: { lte: prisma.inventory.fields.reorderLevel } },
    }),
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { ...sales, saleDate: { gte: thisMonth } } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: "desc" } },
      take: TOP_PRODUCTS,
    }),
    prisma.sale.findMany({
      where: sales,
      select: {
        id: true,
        saleCode: true,
        saleDate: true,
        totalAmount: true,
        customer: { select: { name: true } },
      },
      orderBy: { saleDate: "desc" },
      take: RECENT_ACTIVITIES,
    }),
    prisma.purchase.findMany({
      where: purchases,
      select: {
        id: true,
        purchaseCode: true,
        purchaseDate: true,
        totalAmount: true,
        supplier: { select: { companyName: true } },
      },
      orderBy: { purchaseDate: "desc" },
      take: RECENT_ACTIVITIES,
    }),
    prisma.inventory.findMany({
      where: { organizationId },
      select: {
        productId: true,
        quantityOnHand: true,
        reorderLevel: true,
        product: { select: { name: true } },
      },
      orderBy: { quantityOnHand: "desc" },
      take: INVENTORY_LEVELS,
    }),
  ]);

  // Names for the grouped product ids, scoped to the tenant like everything else.
  const names = new Map(
    (
      await prisma.product.findMany({
        where: { organizationId, id: { in: topGroups.map((g) => g.productId) } },
        select: { id: true, name: true },
      })
    ).map((p) => [p.id, p.name])
  );

  const sum = (agg: { _sum: { totalAmount: number | null } }) => agg._sum.totalAmount ?? 0;

  const recentActivities = [
    ...recentSales.map((s) => ({
      type: "sale" as const,
      id: s.id,
      code: s.saleCode,
      date: s.saleDate,
      amount: s.totalAmount,
      counterparty: s.customer.name,
    })),
    ...recentPurchases.map((p) => ({
      type: "purchase" as const,
      id: p.id,
      code: p.purchaseCode,
      date: p.purchaseDate,
      amount: p.totalAmount,
      counterparty: p.supplier.companyName,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, RECENT_ACTIVITIES);

  return {
    totals: {
      sales: sum(salesTotal),
      purchases: sum(purchasesTotal),
      customers: customerCount,
      products: productCount,
    },
    trends: {
      sales: trendPercent(sum(salesThisMonth), sum(salesLastMonth)),
      purchases: trendPercent(sum(purchasesThisMonth), sum(purchasesLastMonth)),
    },
    lowStockCount,
    topProducts: topGroups.map((g) => ({
      productId: g.productId,
      name: names.get(g.productId) ?? "Unknown product",
      totalSold: g._sum.quantity ?? 0,
      totalRevenue: g._sum.totalPrice ?? 0,
    })),
    recentActivities,
    inventoryLevels: inventoryLevels.map((i) => ({
      productId: i.productId,
      name: i.product.name,
      quantityOnHand: i.quantityOnHand,
      reorderLevel: i.reorderLevel,
    })),
  };
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
