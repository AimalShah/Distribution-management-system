import prisma from "@/lib/prisma";

export async function getBasicPurchaseReport(startDate: string, endDate: string) {
  const purchases = await prisma.purchase.findMany({
    where: {
      purchaseDate: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    include: {
      purchaseItems: true,
      supplier: true,
    },
    orderBy: { purchaseDate: "asc" },
  });

  const totalPurchaseAmount = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalOrders = purchases.length;
  const uniqueSuppliers = new Set(purchases.map(p => p.supplierId)).size;
  const totalItems = purchases.reduce((sum, p) => sum + p.purchaseItems.length, 0);

  const dailyTotals = purchases.reduce((acc: Record<string, number>, p) => {
    const day = p.purchaseDate.toISOString().split("T")[0];
    acc[day] = (acc[day] || 0) + p.totalAmount;
    return acc;
  }, {});

  return {
    totalPurchaseAmount,
    totalOrders,
    uniqueSuppliers,
    totalItems,
    dailyTotals: Object.entries(dailyTotals).map(([date, total]) => ({ date, total })),
  };
}

export async function getPurchaseBySupplier(startDate: string, endDate: string) {
  const purchases = await prisma.purchase.findMany({
    where: {
      purchaseDate: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    include: {
      supplier: true,
    },
  });

  const supplierTotals = purchases.reduce((acc: Record<string, number>, p) => {
    const name = p.supplier?.companyName || "Unknown Supplier";
    acc[name] = (acc[name] || 0) + p.totalAmount;
    return acc;
  }, {});

  return Object.entries(supplierTotals).map(([supplier, total]) => ({
    supplier,
    total,
  }));
}

export async function getPurchaseByProduct(startDate: string, endDate: string) {
  const items = await prisma.purchaseItem.findMany({
    where: {
      purchase: {
        purchaseDate: { gte: new Date(startDate), lte: new Date(endDate) },
      },
    },
    include: {
      product: true,
    },
  });

  const productTotals = items.reduce((acc: Record<string, number>, item) => {
    const productName = item.product?.name || "Unnamed Product";
    acc[productName] = (acc[productName] || 0) + item.totalCost;
    return acc;
  }, {});

  return Object.entries(productTotals).map(([product, total]) => ({
    product,
    total,
  }));
}
