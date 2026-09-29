import prisma from "@/lib/prisma";


export async function getBasicSalesReport(startDate: string, endDate: string) {
  const sales = await prisma.sale.findMany({
    where: {
      saleDate: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    include: {
      items: true,
      customer: true,
    },
    orderBy: { saleDate: "asc" },
  });

  const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const uniqueCustomers = new Set(sales.map(s => s.customerId)).size;
  const totalItems = sales.reduce((sum, sale) => sum + sale.items.length, 0);

  const dailyTotals = sales.reduce((acc: Record<string, number>, sale) => {
    const day = sale.saleDate.toISOString().split("T")[0];
    acc[day] = (acc[day] || 0) + sale.totalAmount;
    return acc;
  }, {});

  return {
    totalSales,
    totalOrders: sales.length,
    uniqueCustomers,
    totalItems,
    dailyTotals: Object.entries(dailyTotals).map(([date, total]) => ({ date, total })),
  };
}


export async function getSalesByCustomer(startDate: string, endDate: string) {
  const sales = await prisma.sale.findMany({
    where: {
      saleDate: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    include: {
      items: { include: { product: true } },
      customer: true,
    },
  });

  const customerTotals = sales.reduce((acc: Record<string, number>, sale) => {
    const name = sale.customer?.name || "Unknown Customer";
    acc[name] = (acc[name] || 0) + sale.totalAmount;
    return acc;
  }, {});

  return Object.entries(customerTotals).map(([customer, total]) => ({
    customer,
    total,
  }));
}

export async function getSalesByProduct(startDate: string, endDate: string) {
  const items = await prisma.saleItem.findMany({
    where: {
      sale: { saleDate: { gte: new Date(startDate), lte: new Date(endDate) } },
    },
    include: { product: true },
  });

  const productTotals = items.reduce((acc: Record<string, number>, item) => {
    const productName = item.product?.name || "Unnamed Product";
    acc[productName] = (acc[productName] || 0) + item.totalPrice;
    return acc;
  }, {});

  return Object.entries(productTotals).map(([product, total]) => ({
    product,
    total,
  }));
}
