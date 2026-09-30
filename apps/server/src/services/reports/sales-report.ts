import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { SalesReportQuery } from "@dms/shared";

const saleWindow = (
  organizationId: string,
  { startDate, endDate }: SalesReportQuery
): Prisma.SaleWhereInput => ({
  organizationId,
  ...(startDate || endDate
    ? {
        saleDate: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      }
    : {}),
});

/**
 * Window totals.
 *
 * `totalItems` in the legacy was `sales.reduce((sum, s) => sum + s.items.length,
 * 0)` — a count of invoice *lines*, reported as "items" beside a quantity, so a
 * reader takes it for units sold. Renamed `totalLineItems`; the unit count is
 * reported separately as `totalQuantity`, from a grouped sum over `SaleItem`
 * rather than the legacy's `include: { items: true }`, which loaded every column
 * of every line of every sale in the window to count them.
 */
export async function getBasicSalesReport(
  organizationId: string,
  query: SalesReportQuery
) {
  const [sales, quantities, lines] = await Promise.all([
    prisma.sale.findMany({
      where: saleWindow(organizationId, query),
      select: {
        id: true,
        saleDate: true,
        totalAmount: true,
        status: true,
        customerId: true,
      },
      orderBy: { saleDate: "asc" },
    }),
    prisma.saleItem.groupBy({
      by: ["saleId"],
      _sum: { quantity: true },
      where: { sale: saleWindow(organizationId, query) },
    }),
    prisma.saleItem.groupBy({
      by: ["saleId"],
      _sum: { totalPrice: true },
      where: { sale: saleWindow(organizationId, query) },
    }),
  ]);

  const totalQuantity = quantities.reduce(
    (sum, group) => sum + (group._sum.quantity ?? 0),
    0
  );

  // The line subtotal per sale, so a header that disagrees with its own lines
  // can be found. See the note on `unreconciledOrders` below.
  const subtotalBySale = new Map<string, number>();
  for (const group of lines) {
    subtotalBySale.set(group.saleId, group._sum.totalPrice ?? 0);
  }
  const totalLineSubtotal = [...subtotalBySale.values()].reduce(
    (sum, value) => sum + value,
    0
  );

  const dailyTotals = new Map<string, number>();
  const byStatus = new Map<string, { orders: number; totalAmount: number }>();
  let unreconciledOrders = 0;

  for (const sale of sales) {
    // `saleDate` is a `timestamp(3)` with no zone, so Prisma hands back a Date
    // whose UTC fields are the stored calendar date. `toISOString()` reads the
    // day back out rather than shifting it.
    const day = sale.saleDate.toISOString().slice(0, 10);
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + sale.totalAmount);

    const status = sale.status || "Unspecified";
    const bucket = byStatus.get(status) ?? { orders: 0, totalAmount: 0 };
    bucket.orders += 1;
    bucket.totalAmount += sale.totalAmount;
    byStatus.set(status, bucket);

    // `Sale.totalAmount` is written straight from the request body by
    // `createInvoice` and never recomputed from the lines, so it can disagree
    // with its own invoice by any amount. Counting the disagreements is cheap;
    // deciding which figure is right is not ours to do here, so both are
    // reported and the count says how far apart they are.
    const subtotal = subtotalBySale.get(sale.id);
    if (subtotal !== undefined && Math.abs(subtotal - sale.totalAmount) > 0.005) {
      unreconciledOrders += 1;
    }
  }

  return {
    totalSales: sales.reduce((sum, s) => sum + s.totalAmount, 0),
    totalLineSubtotal,
    totalOrders: sales.length,
    uniqueCustomers: new Set(sales.map((s) => s.customerId)).size,
    totalLineItems: quantities.length,
    totalQuantity,
    unreconciledOrders,
    // Sorted rather than left in insertion order, which depended on the query
    // happening to sort by date.
    dailyTotals: [...dailyTotals.entries()]
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    // `status` is free text and nothing filtered on it, so pending invoices were
    // summed into the same "total sales" as completed ones. Report the split
    // rather than choosing a status and hiding the other.
    byStatus: [...byStatus.entries()]
      .map(([status, bucket]) => ({ status, ...bucket }))
      .sort((a, b) => a.status.localeCompare(b.status)),
  };
}

/**
 * Sales per customer.
 *
 * The legacy accumulated into an object keyed on `sale.customer?.name`, so two
 * customers sharing a name became one row with their spend added together. It
 * also `include`d `items: { include: { product: true } }` and `customer: true`
 * and then read neither the items nor anything but the name off the customer —
 * every line of every invoice, and every full product row behind it, loaded to
 * produce a name and a total.
 *
 * `Sale.customerId` is non-nullable and the relation is required, so
 * `sale.customer` is never null and the "Unknown Customer" fallback is dead
 * code — and a customer actually named "Unknown Customer" would have collided
 * with it if it were reachable. Keyed on `customerId` now.
 */
export async function getSalesByCustomer(
  organizationId: string,
  query: SalesReportQuery
) {
  // Counted and summed by the database, not by pulling every matching sale into
  // this process and folding it in a `Map`. The old shape was `findMany` over the
  // whole window -- every sale a tenant has ever made, with a join to `Customer`
  // on each -- and then a JavaScript loop to add up numbers the database can add.
  // The result was identical and the memory was not: the response had one entry
  // per customer, but the query had one row per sale.
  const groups = await prisma.sale.groupBy({
    by: ["customerId"],
    where: saleWindow(organizationId, query),
    _count: { _all: true },
    _sum: { totalAmount: true },
    orderBy: { _sum: { totalAmount: "desc" } },
  });

  const customers = await prisma.customer.findMany({
    where: {
      organizationId,
      id: { in: groups.map((group) => group.customerId) },
    },
    select: { id: true, name: true, customerCode: true, isActive: true },
  });
  const byId = new Map(customers.map((customer) => [customer.id, customer]));

  // A group whose customer row has since been deleted has no name to report.
  // `Sale.customerId` is a required relation, so this cannot normally happen; the
  // filter is here so a dangling row drops one line rather than throwing.
  return groups.flatMap((group) => {
    const customer = byId.get(group.customerId);
    if (!customer) return [];

    return [
      {
        customerId: group.customerId,
        name: customer.name,
        customerCode: customer.customerCode,
        isActive: customer.isActive,
        orders: group._count._all,
        totalAmount: group._sum.totalAmount ?? 0,
      },
    ];
  });
}

/**
 * Sales per product.
 *
 * Same name-keyed accumulator as the customer report, same collision: two
 * products sharing a name merged into one line. Keyed on `productId` here, with
 * quantity and average unit price alongside the revenue, because a revenue
 * figure alone cannot distinguish selling 1 at 1000 from 1000 at 1.
 */
export async function getSalesByProduct(
  organizationId: string,
  query: SalesReportQuery
) {
  // Aggregated in the database, as the customer report above is. The old shape
  // loaded every line of every sale in the window into this process and folded it
  // in a `Map`, when the response only ever had one entry per product.
  //
  // The average unit price is the mean of the `unitPrice` *on the lines*, not the
  // revenue-weighted one -- `sum(unitPrice) / count(lines)`, which is what the
  // loop computed and is preserved here. A revenue-weighted average would be a
  // different number and a different question.
  const groups = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: { sale: saleWindow(organizationId, query) },
    _count: { _all: true },
    _sum: { quantity: true, totalPrice: true, unitPrice: true },
    orderBy: { _sum: { totalPrice: "desc" } },
  });

  const products = await prisma.product.findMany({
    where: {
      organizationId,
      id: { in: groups.map((group) => group.productId) },
    },
    select: { id: true, name: true, productCode: true, unit: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  // `SaleItem.productId` is a required relation, so a group always resolves. The
  // filter is here so a dangling row drops one line rather than throwing.
  return groups.flatMap((group) => {
    const product = byId.get(group.productId);
    if (!product) return [];

    const lineCount = group._count._all;
    const priceSum = group._sum.unitPrice ?? 0;

    return [
      {
        productId: group.productId,
        name: product.name,
        productCode: product.productCode,
        unit: product.unit,
        quantity: group._sum.quantity ?? 0,
        totalPrice: group._sum.totalPrice ?? 0,
        averageUnitPrice: lineCount > 0 ? priceSum / lineCount : 0,
      },
    ];
  });
}

export async function getFullSalesReport(
  organizationId: string,
  query: SalesReportQuery
) {
  const [basic, byCustomer, byProduct] = await Promise.all([
    getBasicSalesReport(organizationId, query),
    getSalesByCustomer(organizationId, query),
    getSalesByProduct(organizationId, query),
  ]);

  return { basic, byCustomer, byProduct, generatedAt: new Date() };
}
