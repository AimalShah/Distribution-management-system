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
  const sales = await prisma.sale.findMany({
    where: saleWindow(organizationId, query),
    select: {
      customerId: true,
      totalAmount: true,
      customer: { select: { name: true, customerCode: true, isActive: true } },
    },
  });

  const totals = new Map<
    string,
    {
      name: string;
      customerCode: string;
      isActive: boolean;
      orders: number;
      totalAmount: number;
    }
  >();

  for (const sale of sales) {
    const bucket = totals.get(sale.customerId) ?? {
      name: sale.customer.name,
      customerCode: sale.customer.customerCode,
      isActive: sale.customer.isActive,
      orders: 0,
      totalAmount: 0,
    };
    bucket.orders += 1;
    bucket.totalAmount += sale.totalAmount;
    totals.set(sale.customerId, bucket);
  }

  return [...totals.entries()]
    .map(([customerId, bucket]) => ({ customerId, ...bucket }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
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
  const items = await prisma.saleItem.findMany({
    where: { sale: saleWindow(organizationId, query) },
    select: {
      productId: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
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
      totalPrice: number;
      priceSum: number;
      priceCount: number;
    }
  >();

  for (const item of items) {
    const bucket = totals.get(item.productId) ?? {
      name: item.product.name,
      productCode: item.product.productCode,
      unit: item.product.unit,
      quantity: 0,
      totalPrice: 0,
      priceSum: 0,
      priceCount: 0,
    };
    bucket.quantity += item.quantity;
    bucket.totalPrice += item.totalPrice;
    bucket.priceSum += item.unitPrice;
    bucket.priceCount += 1;
    totals.set(item.productId, bucket);
  }

  return [...totals.entries()]
    .map(([productId, bucket]) => ({
      productId,
      name: bucket.name,
      productCode: bucket.productCode,
      unit: bucket.unit,
      quantity: bucket.quantity,
      totalPrice: bucket.totalPrice,
      averageUnitPrice:
        bucket.priceCount > 0 ? bucket.priceSum / bucket.priceCount : 0,
    }))
    .sort((a, b) => b.totalPrice - a.totalPrice);
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
