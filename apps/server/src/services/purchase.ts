import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type {
  PurchaseFormInput,
  PurchaseItemInput,
  PurchaseUpdateInput,
} from "@dms/shared";
import { fromPaise, percentagePaise, toMoneyNumber, toPaise } from "@dms/shared";
import { badRequest, conflict, notFound } from "../http/errors";
import { applyStockMovement, type StockMovementRequest } from "./stock-movement";
import { serverCache, invalidateTenantMetrics } from "../utils/cache";
import { nextDocumentCode } from "./document-code";

const listInclude = {
  supplier: true,
  // The legacy list embedded every `purchaseItems` row with its product. On a
  // paginated list that is an unbounded payload per row, so the count is sent
  // instead and the lines stay on the detail route.
  _count: { select: { purchaseItems: true } },
} satisfies Prisma.PurchaseInclude;

const detailInclude = {
  supplier: true,
  purchaseItems: { include: { product: true } },
} satisfies Prisma.PurchaseInclude;

/**
 * The legacy `src/components/PurchaseForm.tsx` computed the grand total in the
 * browser: `sum(gross - itemDiscount + taxPercent% of (gross - itemDiscount))
 * - discount + taxAmount`. Recomputing it here keeps the same figure for
 * existing documents while removing a client supplied total the API would
 * otherwise have to trust.
 */
type PurchasePricedLine = Pick<PurchaseItemInput, "quantity" | "taxPercent"> & {
  unitCost: number | { toString(): string };
  itemDiscount?: number | { toString(): string } | null;
};

const lineTotal = (item: PurchasePricedLine) => {
  const grossPaise = BigInt(item.quantity) * toPaise(item.unitCost);
  const itemDiscountPaise = toPaise(item.itemDiscount ?? 0);
  const taxablePaise = grossPaise - itemDiscountPaise;
  const taxPaise = percentagePaise(taxablePaise, item.taxPercent ?? 0);

  return fromPaise(taxablePaise + taxPaise);
};

/**
 * The recompute helpers read the same terms from a stored row that a request
 * body carries (the PUT path re-derives figures from the rows already on the
 * invoice — items cannot be rewritten there, but the header discount the rows
 * were priced under can), so they accept a structural subset of the form item
 * rather than the full create input.
 */
const linesTax = (data: { items: readonly PurchasePricedLine[] }) =>
  data.items.reduce(
    (sum, item) =>
      sum + fromPaise(percentagePaise(
        BigInt(item.quantity) * toPaise(item.unitCost) - toPaise(item.itemDiscount ?? 0),
        item.taxPercent ?? 0
      )),
    0
  );

export const calculatePurchaseTotal = (data: {
  items: readonly PurchasePricedLine[];
  discount?: number | { toString(): string };
}) =>
  fromPaise(data.items.reduce((sum, item) => sum + toPaise(lineTotal(item)), 0n) - toPaise(data.discount ?? 0));

export type PurchaseListArgs = {
  organizationId: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
};

export async function getPurchases({
  organizationId,
  page,
  pageSize,
  search,
  status,
}: PurchaseListArgs) {
  const where: Prisma.PurchaseWhereInput = {
    organizationId,
    deletedAt: null,
  };

  if (status) {
    where.status = { equals: status, mode: "insensitive" };
  }

  if (search) {
    where.purchaseCode = { contains: search, mode: "insensitive" };
  }

  const [data, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: listInclude,
      orderBy: { purchaseDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchase.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

// The legacy `getPurchaseById` ran `findMany` with no `organizationId` filter
// and returned an array, so the detail route answered with a list of every
// matching purchase across all tenants. `findFirst` scoped to the tenant returns
// the single document the route contract promises.
export type PurchaseSupplierListArgs = {
  supplierId: string;
  organizationId: string;
  page: number;
  pageSize: number;
};

/**
 * A supplier's purchase history, paginated.
 *
 * The only other way to read this was `GET /api/suppliers/:id`, whose detail
 * include embedded `purchase: true` -- every purchase the supplier was ever
 * billed on, unbounded. A supplier with a few thousand invoices answered with a
 * few thousand full invoice documents, and it grew without limit until it did.
 *
 * This is the shape `getSalesByCustomer` already has for the customer side, and
 * it is what lets the detail route drop the embed.
 */
export async function getPurchasesBySupplier({
  supplierId,
  organizationId,
  page,
  pageSize,
}: PurchaseSupplierListArgs) {
  const where: Prisma.PurchaseWhereInput = { supplierId, organizationId, deletedAt: null };

  const [data, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: detailInclude,
      orderBy: { purchaseDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchase.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

export async function getPurchaseById(id: string, organizationId: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: detailInclude,
  });

  if (!purchase) {
    throw notFound("Purchase not found", "PURCHASE_NOT_FOUND");
  }

  return purchase;
}

export async function createPurchase(
  data: PurchaseFormInput,
  organizationId: string,
  userId: string
) {
  const totalAmount = calculatePurchaseTotal(data);

  // A discount larger than the goods total produces a negative document, which
  // would then flow into the purchase reports as a real figure.
  if (totalAmount < 0) {
    throw badRequest(
      "Purchase total cannot be negative. Check the discount and tax amounts.",
      "INVALID_TOTAL",
      { totalAmount }
    );
  }

  const purchaseItems = data.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitCost: item.unitCost,
    totalCost: item.quantity * item.unitCost,
    batchNumber: item.batchNumber,
    expiryDate: item.expiryDate,
    taxPercent: item.taxPercent,
    discount: item.itemDiscount,
  }));

  // Legacy `addPurchase` wrote the purchase, the stock movement and the log
  // entries as independent statements: a failure halfway through left a
  // purchase with no stock, or stock with no purchase. One transaction per
  // POST makes the three writes commit or roll back together.
  const result = await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: data.supplierId, organizationId },
      select: { id: true },
    });

    if (!supplier) {
      throw badRequest(
        "The supplier does not exist in this organization",
        "SUPPLIER_NOT_IN_ORGANIZATION",
        { supplierId: data.supplierId }
      );
    }

    // `Inventory.productId` is unique across organizations, so the legacy
    // `upsert({ where: { productId } })` would happily increment another
    // tenant's stock for a product id this organization does not own. Checking
    // the tenant first turns that into a 400 before anything is written.
    const productIds = [...new Set(data.items.map((item) => item.productId))];

    const owned = await tx.product.findMany({
      where: { id: { in: productIds }, organizationId },
      select: { id: true },
    });

    if (owned.length !== productIds.length) {
      const ownedIds = new Set(owned.map((product) => product.id));
      throw badRequest(
        "One or more products do not exist in this organization",
        "PRODUCT_NOT_IN_ORGANIZATION",
        { productIds: productIds.filter((id) => !ownedIds.has(id)) }
      );
    }

    const purchaseCode = await nextDocumentCode(tx, organizationId, "purchase");

    const purchase = await tx.purchase.create({
      data: {
        purchaseCode,
        supplierId: data.supplierId,
        purchaseDate: data.purchaseDate,
        totalAmount,
        discount: data.discount,
        // Derived from the lines' rates, never read from the request body.
        taxAmount: linesTax(data),
        // The legacy service hardcoded "Pending" and dropped the status the
        // form had selected. The stored value is now the requested one.
        status: data.status,
        organizationId,
        purchaseItems: { create: purchaseItems },
      },
      include: detailInclude,
    });

    for (const item of data.items) {
      // A receipt can arrive before the product has any stock row, so the
      // movement carries the reorder level to open it with; the increment
      // itself stays a single statement the database serialises. The ledger
      // row and the lot belong to the same movement, so the module writes
      // them together.
      const batch: StockMovementRequest["batch"] = item.batchNumber
        ? {
            receipt: {
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate,
              unitCost: item.unitCost,
              purchaseItemId: purchase.purchaseItems?.find(
                (pi) => pi.productId === item.productId && pi.batchNumber === item.batchNumber
              )?.id,
            },
          }
        : { untracked: true };

      await applyStockMovement({
        tx,
        organizationId,
        userId,
        productId: item.productId,
        direction: "in",
        quantity: item.quantity,
        movementType: "IN",
        reason: `Stock In from Purchase ${purchaseCode}`,
        reference: purchaseCode,
        opening: { reorderLevel: 10 },
        batch,
      });
    }

    return purchase;
  });

  invalidateTenantMetrics(organizationId, "purchases");
  return result;
}

// Header columns only. `items` is not part of the update schema because
// rewriting lines without replaying the stock movement would leave
// `Inventory.quantityOnHand` disagreeing with the purchase rows.
export async function updatePurchase(
  id: string,
  data: PurchaseUpdateInput,
  organizationId: string
) {
  // `Purchase.supplierId` is a plain foreign key with no organization
  // constraint, so the database would let a PUT re-point the purchase at
  // another tenant's supplier. `createPurchase` refuses exactly this above, and
  // the update path has to refuse it too.
  if (data.supplierId !== undefined) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, organizationId },
      select: { id: true },
    });

    if (!supplier) {
      throw badRequest(
        "The supplier does not exist in this organization",
        "SUPPLIER_NOT_IN_ORGANIZATION",
        { supplierId: data.supplierId }
      );
    }
  }

  const updateData: Prisma.PurchaseUncheckedUpdateInput = { ...data };

  // The PUT cannot rewrite lines (`PurchaseUpdateSchema` omits `items` —
  // rewriting quantities without replaying the stock movement would desync
  // inventory), so every stored line's own terms stay as the create path
  // priced them. The one header term a PUT can change is the discount, and the
  // stored figures were derived from the *old* discount: banking a new one
  // without recomputing would leave `totalAmount` disagreeing with the terms
  // both the document and its printout state. `taxAmount` is not recomputed:
  // it comes from the lines' rates, which a header-only PUT cannot touch.
  if (data.discount !== undefined) {
    const lines = await prisma.purchaseItem.findMany({
      where: { purchase: { id, organizationId, deletedAt: null } },
      select: { quantity: true, unitCost: true, discount: true, taxPercent: true },
    });

    updateData.totalAmount = calculatePurchaseTotal({
      items: lines.map((line) => ({
        quantity: line.quantity,
        unitCost: line.unitCost,
        itemDiscount: line.discount ?? 0,
        taxPercent: line.taxPercent ?? undefined,
      })),
      discount: data.discount,
    });

    if ((updateData.totalAmount as number) < 0) {
      throw badRequest(
        "Purchase total cannot be negative. Check the discount and tax amounts.",
        "INVALID_TOTAL",
        { totalAmount: updateData.totalAmount }
      );
    }
  }

  const updated = await prisma.purchase.update({
    where: { id, organizationId, deletedAt: null },
    data: updateData,
    include: detailInclude,
  });

  invalidateTenantMetrics(organizationId, "purchases");
  return updated;
}

/**
 * Deleting a purchase reverses the stock it moved in, guarded so that a purchase
 * whose goods have already been sold downstream refuses rather than driving stock negative.
 */
export async function deletePurchase(
  id: string,
  organizationId: string,
  userId = "system"
) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.purchase.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        purchaseItems: true,
      },
    });

    if (!existing) {
      throw notFound("Purchase not found", "PURCHASE_NOT_FOUND");
    }

    const activeReturns = await tx.return.count({
      where: { purchaseId: existing.id, organizationId, deletedAt: null },
    });

    if (activeReturns > 0) {
      throw conflict(
        "Returns have been recorded against this purchase. Delete those first, then delete the purchase.",
        "PURCHASE_HAS_RETURNS",
        { purchaseCode: existing.purchaseCode, returns: activeReturns }
      );
    }

    if (existing.status !== "Cancelled") {
      for (const item of existing.purchaseItems) {
        const inventory = await tx.inventory.findFirst({
          where: { productId: item.productId, organizationId },
          select: { quantityOnHand: true },
        });

        const available = inventory?.quantityOnHand ?? 0;
        if (available < item.quantity) {
          throw conflict(
            "There is no longer enough stock on hand to reverse this purchase, so it cannot be deleted",
            "INSUFFICIENT_STOCK",
            { productId: item.productId, available, requested: item.quantity }
          );
        }
      }

      for (const item of existing.purchaseItems) {
        await applyStockMovement({
          tx,
          organizationId,
          userId,
          productId: item.productId,
          direction: "out",
          quantity: item.quantity,
          movementType: "OUT",
          reason: `Reversal of purchase ${existing.purchaseCode}`,
          reference: existing.purchaseCode,
          refusal: (available) =>
            conflict(
              "There is no longer enough stock on hand to reverse this purchase, so it cannot be deleted",
              "INSUFFICIENT_STOCK",
              { productId: item.productId, available, requested: item.quantity }
            ),
        });

        if (item.batchNumber) {
          await tx.stockBatch.updateMany({
            where: {
              productId: item.productId,
              batchNumber: item.batchNumber,
              organizationId,
            },
            data: {
              quantityRemaining: { decrement: item.quantity },
            },
          });
        }
      }
    }

    await tx.purchase.update({
      where: { id: existing.id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  });

  invalidateTenantMetrics(organizationId, "purchases");
  return result;
}
