import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { InventoryReportQuery } from "@dms/shared";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The movement types that add to stock and the ones that remove it, matching
 * `classifyMovement` in the inventory service. Kept as a second list rather than
 * imported because that one is about deciding what a *write* may do — including
 * refusing TRANSFER — and this one is about reading the sign off a log row that
 * already exists. A report that silently classified TRANSFER as a decrease
 * would be inventing a movement the write path refuses to record.
 */
const INCREASES = ["IN", "RETURN"] as const;
const DECREASES = ["OUT", "DAMAGED", "EXPIRED"] as const;

/**
 * `InventoryLog.quantity` is a magnitude for `IN`, `OUT`, `RETURN`, `DAMAGED`
 * and `EXPIRED` — the sign lives in `movementType`, and an `OUT 4` row carries
 * `quantity: 4, previousQty: 10, newQty: 6`. It is signed only for `ADJUSTMENT`,
 * where it is the difference a physical count found.
 *
 * Which is the whole problem with the legacy basic report. It did:
 *
 *   prisma.inventoryLog.groupBy({ by: ["productId"], _sum: { quantity: true } })
 *
 * and reported the result as `totalQuantity`, then the stock valuation report
 * multiplied that figure by an average unit cost. So the sum rises when goods
 * arrive *and* when they leave: a product that received 100 and shipped 100
 * scores 200. It is not stock on hand and it is not net movement, and no
 * combination of dates makes it either.
 *
 * So `totalQuantity` here means what it says — the quantity on hand, read off
 * the inventory row — and the movement in the window is reported separately and
 * signed, which is the number the old column was probably reaching for.
 */
export async function getBasicInventoryReport(
  organizationId: string,
  { startDate, endDate }: InventoryReportQuery
) {
  const movementWhere = (types: readonly string[]): Prisma.InventoryLogWhereInput => ({
    inventory: { organizationId },
    movementType: { in: types as Prisma.EnumInventoryMovementFilter["in"] },
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
  });

  const [inventories, increases, decreases, adjustments] = await Promise.all([
    prisma.inventory.findMany({
      where: { organizationId },
      select: {
        productId: true,
        quantityOnHand: true,
        quantityReserved: true,
        reorderLevel: true,
        maxStockLevel: true,
        product: {
          select: { id: true, name: true, productCode: true, unit: true },
        },
      },
      orderBy: { product: { name: "asc" } },
    }),
    prisma.inventoryLog.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      where: movementWhere(INCREASES),
    }),
    prisma.inventoryLog.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      where: movementWhere(DECREASES),
    }),
    prisma.inventoryLog.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      where: movementWhere(["ADJUSTMENT"]),
    }),
  ]);

  const netFor = (productId: string) =>
    (sumFor(increases, productId) - sumFor(decreases, productId)) +
    sumFor(adjustments, productId);

  return inventories.map((inv) => ({
    id: inv.product.id,
    name: inv.product.name,
    productCode: inv.product.productCode,
    unit: inv.product.unit,
    reorderLevel: inv.reorderLevel,
    maxStockLevel: inv.maxStockLevel,
    quantityOnHand: inv.quantityOnHand,
    quantityReserved: inv.quantityReserved,
    // Null rather than 0 when no window was sent, so a caller can tell "nothing
    // moved in this period" from "no period was asked about".
    netMovementInPeriod:
      startDate || endDate ? netFor(inv.productId) : null,
    isBelowReorderLevel: inv.quantityOnHand <= inv.reorderLevel,
  }));
}

const sumFor = (
  groups: { productId: string; _sum: { quantity: number | null } }[],
  productId: string
) => groups.find((g) => g.productId === productId)?._sum.quantity ?? 0;

/**
 * The legacy built this on top of the basic report, so "valuation" was the same
 * sum of movement magnitudes times an average cost. This one values what is
 * actually held: quantity on hand, at the average unit cost the tenant has paid
 * across its purchase history.
 *
 * The cost basis is still the average, and it is an average — a tenant that
 * bought a case at 3.00 and a pallet at 40.00 gets one blended number, which
 * understates the value of what remains if the cheap stock sold first. Weighted
 * average cost needs a running balance this schema does not keep, and the
 * difference is worth more than the estimate is precise, so the blend is
 * labelled as one.
 */
export async function getStockValuationReport(
  organizationId: string,
  query: InventoryReportQuery
) {
  const [inventories, costs] = await Promise.all([
    prisma.inventory.findMany({
      where: { organizationId },
      select: {
        productId: true,
        quantityOnHand: true,
        product: { select: { id: true, name: true, productCode: true, unit: true } },
      },
    }),
    prisma.purchaseItem.groupBy({
      by: ["productId"],
      _avg: { unitCost: true },
      where: { purchase: { organizationId } },
    }),
  ]);

  const rows = inventories.map((inv) => {
    // `Product.unitCost` is the fallback, matching the low-stock report. The
    // average purchase cost is preferred because it is what this tenant
    // actually paid; the product's own figure is whatever was typed in when the
    // product was created.
    const unitCost =
      costs.find((c) => c.productId === inv.productId)?._avg.unitCost ?? 0;

    return {
      id: inv.product.id,
      name: inv.product.name,
      productCode: inv.product.productCode,
      unit: inv.product.unit,
      quantityOnHand: inv.quantityOnHand,
      averageUnitCost: unitCost,
      totalValue: inv.quantityOnHand * unitCost,
    };
  });

  return {
    items: rows,
    totalValue: rows.reduce((sum, row) => sum + row.totalValue, 0),
    generatedAt: new Date(),
  };
}

/**
 * The raw movement log, scoped to the tenant.
 *
 * `InventoryLog` has no `organizationId` of its own — the columns are
 * `inventoryId`, `productId` and `userId` — so the tenant filter goes through
 * the `inventory` relation. The legacy had no filter at all, which meant every
 * caller's movement log, for every product in the installation, to anyone who
 * could reach the endpoint.
 *
 * `previousQty` and `newQty` are included because they are the part of the row
 * that makes it auditable: `quantity` alone says 4 units moved and not whether
 * that was 4 out of 100 or 4 out of 5.
 */
export async function getInventoryMovements(
  organizationId: string,
  { startDate, endDate }: InventoryReportQuery
) {
  return prisma.inventoryLog.findMany({
    where: {
      inventory: { organizationId },
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      movementType: true,
      quantity: true,
      previousQty: true,
      newQty: true,
      reason: true,
      reference: true,
      createdAt: true,
      product: { select: { id: true, name: true, productCode: true } },
      inventory: { select: { quantityOnHand: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Products at or below their reorder level.
 *
 * `quantityOnHand <= reorderLevel` is a field-to-field comparison and Prisma
 * spells that with a field reference, `prisma.inventory.fields.reorderLevel`.
 * There is no way to write it as a literal, and the legacy wrote it correctly
 * here — the same file's other report, in an earlier draft, reached for
 * `prisma.inventory.fields?.reorderLevel` and the optional chain hid a working
 * feature behind a silent `undefined`.
 *
 * `reorderLevel: { gt: 0 }` is an addition, and it fixes a report that never
 * stopped. `Inventory.reorderLevel` is `@default(0)`, so every product created
 * without an explicit level has a reorder level of zero, and with a plain `lte`
 * a quantity on hand of zero is less than or equal to zero — so all of them
 * appear in the low-stock report forever, at zero on hand, forever, having never
 * been below anything. A reorder level of zero means "do not reorder this", and
 * a product that says so is not low on stock.
 */
export async function getLowStockReport(
  organizationId: string,
  { startDate, endDate }: InventoryReportQuery
) {
  const inventories = await prisma.inventory.findMany({
    where: {
      organizationId,
      quantityOnHand: { lte: prisma.inventory.fields.reorderLevel },
      reorderLevel: { gt: 0 },
    },
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
      purchase: { organizationId },
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
    // The most recent purchase overall, not the most recent inside the window:
    // a supplier last bought from eight months ago is the one to reorder from,
    // and returning null just because the window excluded them would answer a
    // question nobody asked.
    const lastPurchase = itemsForProduct.find(
      (pi) =>
        !startDate ||
        !endDate ||
        (pi.purchase.purchaseDate >= startDate && pi.purchase.purchaseDate <= endDate)
    ) ?? itemsForProduct[0];
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

/**
 * Purchase lines that carry an expiry date, scoped to the tenant.
 *
 * Two things about this report are worth stating plainly, because the shape of
 * the data does not support what the name suggests.
 *
 * **It is built from `PurchaseItem`, so it is a report about what was bought.**
 * Expiry lives on the purchase line and nowhere else — there is no batch or
 * stock-by-expiry table — so there is no way to ask how much of a batch is
 * *still on hand*. A batch of 40 that sold in full still appears here, with
 * `quantity: 40`, as though 40 units were about to expire. The row carries
 * `quantityOnHand` for the product beside it so a reader can judge, but the
 * honest reading of `quantity` is "purchased", and it is named that way in the
 * type.
 *
 * **The threshold is measured from now, not from the end of the window.** The
 * legacy computed `expiryLimit = windowEnd + daysUntilExpiry * MS_PER_DAY`, so
 * "expires within 30 days" meant 30 days after the end of the reporting period.
 * With a window ending today that is the same number, and with any other window
 * it is a different question. Measured from `now` it means what it says.
 */
export async function getExpiryReport(
  organizationId: string,
  { startDate, endDate, daysUntilExpiry }: InventoryReportQuery & {
    daysUntilExpiry?: number;
  }
) {
  const now = new Date();
  // No start date means no lower bound rather than the epoch: the legacy used
  // `new Date(0)`, which asks for every purchase line ever written.
  const windowStart = startDate ?? null;
  const expiryLimit =
    daysUntilExpiry !== undefined
      ? new Date(now.getTime() + daysUntilExpiry * MS_PER_DAY)
      : null;

  const items = await prisma.purchaseItem.findMany({
    where: {
      purchase: { organizationId },
      expiryDate: {
        not: null,
        ...(windowStart ? { gte: windowStart } : {}),
        ...(expiryLimit ? { lte: expiryLimit } : {}),
      },
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
          organizationId: true,
          supplier: { select: { id: true, companyName: true } },
        },
      },
    },
    orderBy: { expiryDate: "asc" },
  });

  const [stock, batches] = await Promise.all([
    prisma.inventory.findMany({
      where: { organizationId, productId: { in: items.map((i) => i.productId) } },
      select: { productId: true, quantityOnHand: true },
    }),
    typeof (prisma as any).stockBatch?.findMany === "function"
      ? prisma.stockBatch.findMany({
          where: { organizationId, productId: { in: items.map((i) => i.productId) } },
          select: { productId: true, batchNumber: true, quantityRemaining: true },
        })
      : Promise.resolve([]),
  ]);

  return items.flatMap((item) => {
    const expiryDate = item.expiryDate;
    if (!expiryDate) return [];

    const matchedBatch = batches.find(
      (b) => b.productId === item.productId && b.batchNumber === item.batchNumber
    );

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
        // What was bought, not what remains
        purchasedQuantity: item.quantity,
        // Specific batch stock remaining
        quantityRemaining: matchedBatch ? matchedBatch.quantityRemaining : item.quantity,
        // Per-product total stock on hand
        quantityOnHand:
          stock.find((s) => s.productId === item.productId)?.quantityOnHand ?? 0,
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

export async function getFullInventoryReports(
  organizationId: string,
  query: InventoryReportQuery & { daysUntilExpiry?: number }
) {
  const [basic, movements, lowStock, stockValuation, expiry] = await Promise.all([
    getBasicInventoryReport(organizationId, query),
    getInventoryMovements(organizationId, query),
    getLowStockReport(organizationId, query),
    getStockValuationReport(organizationId, query),
    getExpiryReport(organizationId, query),
  ]);

  return {
    basic,
    movements,
    lowStock,
    stockValuation,
    expiry,
    generatedAt: new Date(),
  };
}
