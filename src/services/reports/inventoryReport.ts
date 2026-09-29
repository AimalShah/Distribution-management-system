import prisma from "@/lib/prisma";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type BasicInventoryReportItem = {
  id: string;
  name: string;
  reorderLevel: number;
  totalQuantity: number;
  costPrice: number;
  totalValue: number;
};

export type LowStockReportItem = {
  id: string;
  name: string;
  productCode: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  maxStockLevel: number | null;
  shortfall: number;
  unitCost: number;
  estimatedRestockCost: number;
  supplier: { id: string; companyName: string } | null;
  lastPurchaseDate: Date | null;
};

export type ExpiryReportItem = {
  id: string;
  productId: string;
  name: string;
  productCode: string;
  unit: string;
  batchNumber: string | null;
  expiryDate: Date;
  daysUntilExpiry: number;
  isExpired: boolean;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchase: {
    id: string;
    purchaseCode: string;
    purchaseDate: Date;
    supplier: { id: string; companyName: string };
  };
};

export type InventoryMovementReportItem = Awaited<
  ReturnType<typeof getInventoryMovements>
>[number];

export type StockValuationReportItem = Awaited<
  ReturnType<typeof getStockValuationReport>
>[number];

export async function getBasicInventoryReport(
  startDate: string,
  endDate: string
): Promise<BasicInventoryReportItem[]> {
  const movements = await prisma.inventoryLog.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
    where: {
      createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
    },
  });

  const productIds = movements.map((m) => m.productId);

  const inventories = await prisma.inventory.findMany({
    where: { productId: { in: productIds } },
    select: {
      productId: true,
      reorderLevel: true,
      quantityOnHand: true,
      product: { select: { id: true, name: true } },
    },
  });

  const purchaseData = await prisma.purchaseItem.groupBy({
    by: ["productId"],
    _avg: { unitCost: true },
    where: { productId: { in: productIds } },
  });

  return inventories.map((inv) => {
    const movement = movements.find((m) => m.productId === inv.productId);
    const costInfo = purchaseData.find((c) => c.productId === inv.productId);

    const totalQty = movement?._sum.quantity || 0;
    const costPrice = costInfo?._avg.unitCost || 0;
    const totalValue = totalQty * costPrice;

    return {
      id: inv.product.id,
      name: inv.product.name,
      reorderLevel: inv.reorderLevel,
      totalQuantity: totalQty,
      costPrice,
      totalValue,
    };
  });
}

export async function getStockValuationReport(
  startDate: string,
  endDate: string
) {
  const basic = await getBasicInventoryReport(startDate, endDate);
  return basic.map((b) => ({
    ...b,
    totalValue: b.totalQuantity * (b.costPrice || 0),
  }));
}

export async function getInventoryMovements(
  startDate: string,
  endDate: string
) {
  return prisma.inventoryLog.findMany({
    select: {
      id: true,
      product: { select: { id: true, name: true } },
      movementType: true,
      quantity: true,
      createdAt: true,
      reference: true,
    },
    where: {
      createdAt: {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLowStockReport(
  startDate: string,
  endDate: string
): Promise<LowStockReportItem[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const inventories = await prisma.inventory.findMany({
    where: { quantityOnHand: { lte: prisma.inventory.fields.reorderLevel } },
    select: {
      productId: true,
      quantityOnHand: true,
      reorderLevel: true,
      maxStockLevel: true,
      product: {
        select: {
          id: true,
          name: true,
          productCode: true,
          unit: true,
          unitCost: true,
        },
      },
    },
    orderBy: { quantityOnHand: "asc" },
  });

  const purchaseItems = await prisma.purchaseItem.findMany({
    where: {
      productId: { in: inventories.map((inv) => inv.productId) },
    },
    select: {
      productId: true,
      purchase: {
        select: {
          purchaseDate: true,
          supplier: { select: { id: true, companyName: true } },
        },
      },
    },
    orderBy: { purchase: { purchaseDate: "desc" } },
  });

  return inventories.map((inv) => {
    const itemsForProduct = purchaseItems.filter(
      (pi) => pi.productId === inv.productId
    );
    const purchaseInWindow = itemsForProduct.find(
      (pi) =>
        pi.purchase.purchaseDate >= start && pi.purchase.purchaseDate <= end
    );
    const lastPurchase = purchaseInWindow ?? itemsForProduct[0];
    const shortfall = Math.max(0, inv.reorderLevel - inv.quantityOnHand);

    return {
      id: inv.product.id,
      name: inv.product.name,
      productCode: inv.product.productCode,
      unit: inv.product.unit,
      quantityOnHand: inv.quantityOnHand,
      reorderLevel: inv.reorderLevel,
      maxStockLevel: inv.maxStockLevel,
      shortfall,
      unitCost: inv.product.unitCost,
      estimatedRestockCost: shortfall * inv.product.unitCost,
      supplier: lastPurchase?.purchase.supplier ?? null,
      lastPurchaseDate: lastPurchase?.purchase.purchaseDate ?? null,
    };
  });
}

export async function getExpiryReport(
  startDate: string,
  endDate: string,
  daysUntilExpiry?: number
): Promise<ExpiryReportItem[]> {
  const windowStart = startDate ? new Date(startDate) : new Date(0);
  const windowEnd = endDate ? new Date(endDate) : new Date();
  const expiryLimit =
    daysUntilExpiry != null && Number.isFinite(daysUntilExpiry)
      ? new Date(windowEnd.getTime() + daysUntilExpiry * MS_PER_DAY)
      : windowEnd;

  const items = await prisma.purchaseItem.findMany({
    where: {
      expiryDate: { gte: windowStart, lte: expiryLimit },
    },
    select: {
      id: true,
      productId: true,
      quantity: true,
      unitCost: true,
      totalCost: true,
      batchNumber: true,
      expiryDate: true,
      product: {
        select: { id: true, name: true, productCode: true, unit: true },
      },
      purchase: {
        select: {
          id: true,
          purchaseCode: true,
          purchaseDate: true,
          supplier: { select: { id: true, companyName: true } },
        },
      },
    },
    orderBy: { expiryDate: "asc" },
  });

  const now = new Date();

  return items.flatMap((item): ExpiryReportItem[] => {
    const expiryDate = item.expiryDate;
    if (!expiryDate) return [];

    return [
      {
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        productCode: item.product.productCode,
        unit: item.product.unit,
        batchNumber: item.batchNumber,
        expiryDate,
        daysUntilExpiry: Math.ceil(
          (expiryDate.getTime() - now.getTime()) / MS_PER_DAY
        ),
        isExpired: expiryDate < now,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        purchase: {
          id: item.purchase.id,
          purchaseCode: item.purchase.purchaseCode,
          purchaseDate: item.purchase.purchaseDate,
          supplier: item.purchase.supplier,
        },
      },
    ];
  });
}
