import prisma from "@dms/db";
import { toMoneyNumber } from "@dms/shared";
import { serverCache } from "../utils/cache";

async function getReturnCredits(organizationId: string): Promise<number> {
  // SAFETY: Testing mock environments might not define $queryRaw on prisma client.
  const hasRawQuery = "$queryRaw" in (prisma as Record<string, unknown>) && typeof (prisma as { $queryRaw?: unknown }).$queryRaw === "function";
  if (hasRawQuery && process.env.NODE_ENV !== "test") {
    try {
      const res = await prisma.$queryRaw<Array<{ total: number | null }>>`
        SELECT COALESCE(SUM(ri.quantity * ri."unitPrice" + ri."taxAmount" - ri.discount), 0)::float as total
        FROM "return_items" ri
        JOIN "returns" r ON ri."returnId" = r.id
        WHERE r."organizationId" = ${organizationId} AND r."deletedAt" IS NULL AND r."returnType" = 'SALE'
      `;

      return Number(res[0]?.total ?? 0);
    } catch {
      // Fallback to findMany if raw query fails
    }
  }

  const returnCreditsRows = await prisma.return.findMany({
    where: { organizationId, deletedAt: null, returnType: "SALE" },
    select: {
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          taxAmount: true,
          discount: true,
        },
      },
    },
  });

  return returnCreditsRows.reduce(
    (sum, ret) =>
      sum +
      ret.items.reduce(
        (lineSum, item) =>
          lineSum + item.quantity * toMoneyNumber(item.unitPrice) + toMoneyNumber(item.taxAmount) - toMoneyNumber(item.discount),
        0
      ),
    0
  );
}

/**
 * Everything the dashboard renders, in one round trip.
 *
 * The legacy page issued five separate fetches and then reduced the whole
 * sale, product and customer collections on the client to get its headline
 * numbers, so what the page showed drifted from what the API reports. The
 * counters are aggregates here, and the lists are only the rows the feed and
 * the chart actually render rather than whichever page of a table happened to
 * be fetched.
 *
 * `topInventory` is ordered server side because the inventory list endpoint
 * sorts by `updatedAt` — right for a table, wrong for a "biggest stock" chart
 * — and because the chart wants ten rows rather than a page the user chose.
 *
 * Sales and purchases are reported as amounts, not counts, because that is
 * what the legacy cards put a currency sign in front of; the counts are not
 * shown anywhere and are not worth a query.
 */
export async function getDashboardStats(organizationId: string): Promise<unknown> {
  return serverCache.getOrSet(`dashboard:${organizationId}`, 15 * 1000, async () => {
    const now = new Date();
    const threshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalProducts,
      totalCustomers,
      totalSuppliers,
      salesTotal,
      purchasesTotal,
      lowStockCount,
      recentSales,
      recentPurchases,
      topInventory,
      expiringSoonCount,
      expiredCount,
      expiringBatches,
      outstanding,
      returnCredits,
      unallocatedPayments,
    ] = await Promise.all([
      prisma.product.count({ where: { organizationId } }),
      prisma.customer.count({ where: { organizationId } }),
      prisma.supplier.count({ where: { organizationId } }),
      prisma.sale.aggregate({
        // Soft-deleted invoices gave their stock back; they are not revenue.
        where: { organizationId, deletedAt: null },
        _sum: { totalAmount: true },
      }),
      prisma.purchase.aggregate({
        where: { organizationId },
        _sum: { totalAmount: true },
      }),
      prisma.inventory.count({
        where: {
          organizationId,
          quantityOnHand: { lte: prisma.inventory.fields.reorderLevel },
        },
      }),
      prisma.sale.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          id: true,
          // `Sale` has `saleCode`, not the `invoiceNumber` the legacy UI read.
          saleCode: true,
          totalAmount: true,
          status: true,
          saleDate: true,
          customer: { select: { name: true } },
        },
        orderBy: { saleDate: "desc" },
        take: 5,
      }),
      prisma.purchase.findMany({
        where: { organizationId },
        select: {
          id: true,
          purchaseCode: true,
          totalAmount: true,
          status: true,
          purchaseDate: true,
          supplier: { select: { companyName: true, contactPerson: true } },
        },
        orderBy: { purchaseDate: "desc" },
        take: 5,
      }),
      prisma.inventory.findMany({
        where: { organizationId },
        select: {
          id: true,
          quantityOnHand: true,
          reorderLevel: true,
          product: { select: { name: true, productCode: true } },
        },
        orderBy: { quantityOnHand: "desc" },
        take: 10,
      }),
      // Batches expiring in the near future (between now and threshold)
      prisma.stockBatch.count({
        where: {
          organizationId,
          quantityRemaining: { gt: 0 },
          expiryDate: { not: null, gte: now, lte: threshold },
        },
      }),
      // Already-expired batches needing write-off
      prisma.stockBatch.count({
        where: {
          organizationId,
          quantityRemaining: { gt: 0 },
          expiryDate: { not: null, lt: now },
        },
      }),
      prisma.stockBatch.findMany({
        where: {
          organizationId,
          quantityRemaining: { gt: 0 },
          expiryDate: { not: null, gte: now, lte: threshold },
        },
        include: {
          product: { select: { id: true, name: true, productCode: true, unit: true } },
        },
        orderBy: { expiryDate: "asc" },
        take: 5,
      }),
      // The real Outstanding figure: sum of unpaid balances on non-cancelled invoices
      prisma.sale.aggregate({
        where: { organizationId, deletedAt: null, status: { not: "Cancelled" } },
        _sum: { totalAmount: true, amountPaid: true },
      }),
      getReturnCredits(organizationId),
      // Unallocated payments sitting as cash on customer accounts
      prisma.payment.aggregate({
        where: { organizationId, deletedAt: null, saleId: null },
        _sum: { amount: true },
      }),
    ]);

    const unpaidSales = toMoneyNumber(outstanding._sum.totalAmount ?? 0) - toMoneyNumber(outstanding._sum.amountPaid ?? 0);
    const unallocated = toMoneyNumber(unallocatedPayments._sum.amount ?? 0);
    const netOutstanding = Math.max(0, unpaidSales - returnCredits - unallocated);

    return {
      totalProducts,
      totalCustomers,
      totalSuppliers,
      // An organization with no sales aggregates to `null`; the page renders a
      // zero rather than a blank, so the sum is normalized here once.
      totalSalesAmount: toMoneyNumber(salesTotal._sum.totalAmount ?? 0),
      totalPurchasesAmount: toMoneyNumber(purchasesTotal._sum.totalAmount ?? 0),
      lowStockCount,
      recentSales,
      recentPurchases,
      topInventory,
      expiringSoonCount,
      expiredCount,
      expiringBatches,
      outstanding: netOutstanding,
    };
  });
}
