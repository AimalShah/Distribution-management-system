import prisma from "@dms/db";

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
export async function getDashboardStats(organizationId: string) {
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
  ] = await Promise.all([
    prisma.product.count({ where: { organizationId } }),
    prisma.customer.count({ where: { organizationId } }),
    prisma.supplier.count({ where: { organizationId } }),
    prisma.sale.aggregate({
      where: { organizationId },
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
      where: { organizationId },
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
  ]);

  return {
    totalProducts,
    totalCustomers,
    totalSuppliers,
    // An organization with no sales aggregates to `null`; the page renders a
    // zero rather than a blank, so the sum is normalized here once.
    totalSalesAmount: salesTotal._sum.totalAmount ?? 0,
    totalPurchasesAmount: purchasesTotal._sum.totalAmount ?? 0,
    lowStockCount,
    recentSales,
    recentPurchases,
    topInventory,
  };
}
