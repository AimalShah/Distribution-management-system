import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type {
  PurchaseFormInput,
  PurchaseItemInput,
  PurchaseUpdateInput,
} from "@dms/shared";
import { badRequest } from "../http/errors";

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
const lineTotal = (item: PurchaseItemInput) => {
  const gross = item.quantity * item.unitCost;
  const itemDiscount = item.itemDiscount ?? 0;
  const tax = ((item.taxPercent ?? 0) / 100) * (gross - itemDiscount);
  return gross - itemDiscount + tax;
};

export const calculatePurchaseTotal = (data: PurchaseFormInput) =>
  data.items.reduce((sum, item) => sum + lineTotal(item), 0) -
  (data.discount ?? 0) +
  (data.taxAmount ?? 0);

export type PurchaseListArgs = {
  organizationId: string;
  page: number;
  pageSize: number;
  search?: string;
};

export async function getPurchases({
  organizationId,
  page,
  pageSize,
  search,
}: PurchaseListArgs) {
  const where: Prisma.PurchaseWhereInput = {
    organizationId,
    ...(search ? { purchaseCode: { contains: search, mode: "insensitive" } } : {}),
  };

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
  const where: Prisma.PurchaseWhereInput = { supplierId, organizationId };

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
  return prisma.purchase.findFirst({
    where: { id, organizationId },
    include: detailInclude,
  });
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
  return prisma.$transaction(async (tx) => {
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

    const purchase = await tx.purchase.create({
      data: {
        purchaseCode: data.purchaseCode,
        supplierId: data.supplierId,
        purchaseDate: data.purchaseDate,
        totalAmount,
        discount: data.discount,
        taxAmount: data.taxAmount,
        // The legacy service hardcoded "Pending" and dropped the status the
        // form had selected. The stored value is now the requested one.
        status: data.status,
        organizationId,
        purchaseItems: { create: purchaseItems },
      },
      include: detailInclude,
    });

    for (const item of data.items) {
      // The increment is left to the database rather than computed from a read.
      // A read-modify-write cannot hold under READ COMMITTED: two purchases for
      // the same product both read 5, both write 15, and 20 units received are
      // recorded as 10. `{ increment }` is a single statement against the row it
      // updates, so the database serialises it, and it also makes two lines for
      // the same product accumulate because each one increments the same row.
      const inventory = await tx.inventory.upsert({
        where: { productId: item.productId },
        update: { quantityOnHand: { increment: item.quantity } },
        create: {
          productId: item.productId,
          organizationId,
          quantityOnHand: item.quantity,
          reorderLevel: 10,
        },
      });

      // `upsert` returns the row as it stands after this statement, so the
      // ledger's opening figure is derived from it. previousQty + quantity =
      // newQty therefore holds by construction, including when another
      // purchase committed between two lines of the same document.
      const newQty = inventory.quantityOnHand;
      const previousQty = newQty - item.quantity;

      await tx.inventoryLog.create({
        data: {
          inventoryId: inventory.id,
          productId: item.productId,
          userId,
          movementType: "IN",
          quantity: item.quantity,
          previousQty,
          newQty,
          reason: `Stock In from Purchase ${data.purchaseCode}`,
          reference: data.purchaseCode,
        },
      });
    }

    return purchase;
  });
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

  return prisma.purchase.update({
    where: { id, organizationId },
    data: updateData,
    include: detailInclude,
  });
}

// Deleting a purchase does not reverse the stock it moved in; the legacy action
// behaved the same way. A cancel or reverse flow is still needed, otherwise the
// quantity stays inflated after a purchase is removed.
export async function deletePurchase(id: string, organizationId: string) {
  await prisma.purchase.delete({ where: { id, organizationId } });
}
