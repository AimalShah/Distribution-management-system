import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { SaleInvoiceInput, SaleUpdateInput } from "@dms/shared";
import { badRequest, conflict } from "../http/errors";

const listInclude = {
  customer: true,
  // The legacy list embedded every line with its product. That is an unbounded
  // payload per row once paging is added, so the count is sent instead and the
  // lines stay on the detail routes.
  _count: { select: { items: true } },
} satisfies Prisma.SaleInclude;

const detailInclude = {
  customer: true,
  items: { include: { product: true } },
} satisfies Prisma.SaleInclude;

/**
 * `src/components/sale-invoice/SaleInvoiceForm.tsx` computed the document total
 * in the browser as `sum(quantity * unitPrice) + taxAmount - discount`. Line
 * `taxPercent` is stored on the line but was never part of that sum, so it is
 * not part of this one either.
 */
export const calculateSaleTotal = (data: SaleInvoiceInput) =>
  data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) +
  (data.taxAmount ?? 0) -
  (data.discount ?? 0);

export type SaleListArgs = {
  organizationId: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: SaleInvoiceInput["status"];
};

/** Total units of one product across every line, so repeats are checked together. */
const demandByProduct = (data: SaleInvoiceInput) => {
  const demand = new Map<string, number>();
  for (const item of data.items) {
    demand.set(item.productId, (demand.get(item.productId) ?? 0) + item.quantity);
  }
  return demand;
};

export async function getSales({ organizationId, page, pageSize, search, status }: SaleListArgs) {
  const where: Prisma.SaleWhereInput = {
    organizationId,
    ...(status ? { status } : {}),
    ...(search ? { saleCode: { contains: search, mode: "insensitive" } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: listInclude,
      orderBy: { saleDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sale.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

/**
 * `:id` matches either the cuid or the human readable `saleCode`, which is the
 * union of the legacy `getSaleInvoiceDetail(saleCode)` and the id addressed
 * routes. Both are scoped: the legacy `findUnique({ where: { saleCode } })` had
 * no `organizationId` filter, so any tenant could read another tenant's invoice
 * by guessing its code.
 */
export async function getSaleByIdOrCode(idOrCode: string, organizationId: string) {
  return prisma.sale.findFirst({
    where: { organizationId, OR: [{ id: idOrCode }, { saleCode: idOrCode }] },
    include: detailInclude,
  });
}

// The legacy `getSaleByCustomer` filtered on `customerId` alone, so a customer
// id from another tenant returned their whole sales history. Scoped here.
export async function getSalesByCustomer(customerId: string, organizationId: string) {
  return prisma.sale.findMany({
    where: { customerId, organizationId },
    include: detailInclude,
    orderBy: { saleDate: "desc" },
  });
}

export async function createSale(data: SaleInvoiceInput, organizationId: string, userId: string) {
  const totalAmount = calculateSaleTotal(data);

  if (totalAmount < 0) {
    throw badRequest(
      "Sale total cannot be negative. Check the discount and tax amounts.",
      "INVALID_TOTAL",
      { totalAmount }
    );
  }

  const saleItems = data.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.quantity * item.unitPrice,
    taxPercent: item.taxPercent,
  }));

  // Legacy `addSaleInvoice` wrote the sale, the stock deductions and the log
  // entries as independent statements, so a failure part way through left a
  // sale with stock still on hand. One transaction per POST commits or rolls
  // back all three.
  return prisma.$transaction(async (tx) => {
    // `Sale.customerId` and `SaleItem.productId` are plain foreign keys with no
    // organization constraint, so the database will happily bill a sale to
    // another tenant's customer or sell their product. Both are checked before
    // anything is written.
    const customer = await tx.customer.findFirst({
      where: { id: data.customerId, organizationId },
      select: { id: true },
    });

    if (!customer) {
      throw badRequest(
        "The customer does not exist in this organization",
        "CUSTOMER_NOT_IN_ORGANIZATION",
        { customerId: data.customerId }
      );
    }

    const productIds = [...demandByProduct(data).keys()];
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

    // The legacy service deducted optimistically and clamped at zero:
    // `quantityOnHand: Math.max(0, newQty)` with only a `console.warn`. Selling
    // 10 of 5 in stock left 0 on hand and still logged an `OUT` of 10 whose own
    // previousQty/newQty pair said only 5 had moved. This refuses the document
    // instead, so the log always satisfies previousQty - quantity = newQty.
    //
    // `quantityOnHand` is the only figure consulted: nothing in the legacy code
    // reserves stock, so `quantityReserved` is not part of availability yet.
    const shortages: { productId: string; available: number; requested: number }[] = [];

    for (const [productId, requested] of demandByProduct(data)) {
      const inventory = await tx.inventory.findFirst({
        where: { productId, organizationId },
        select: { quantityOnHand: true },
      });
      const available = inventory?.quantityOnHand ?? 0;
      if (requested > available) {
        shortages.push({ productId, available, requested });
      }
    }

    if (shortages.length > 0) {
      throw conflict(
        "Not enough stock to fulfil this sale",
        "INSUFFICIENT_STOCK",
        { shortages }
      );
    }

    const sale = await tx.sale.create({
      data: {
        saleCode: data.saleCode,
        customerId: data.customerId,
        saleDate: data.saleDate,
        totalAmount,
        discount: data.discount,
        taxAmount: data.taxAmount,
        status: data.status,
        organizationId,
        items: { create: saleItems },
      },
      include: detailInclude,
    });

    for (const item of data.items) {
      // Re-read inside the loop so two lines for the same product deduct in
      // sequence instead of both starting from the same quantity.
      const inventory = await tx.inventory.findFirst({
        where: { productId: item.productId, organizationId },
      });

      // The availability pass above already refused any product with no
      // inventory row, but it ran as a separate read: a concurrent delete of
      // that row would be visible here under READ COMMITTED. Refuse rather than
      // write a log entry pointing at nothing.
      if (!inventory) {
        throw conflict(
          "The stock record for one of the products no longer exists",
          "INVENTORY_ROW_MISSING",
          { productId: item.productId }
        );
      }

      const previousQty = inventory.quantityOnHand;
      const newQty = previousQty - item.quantity;

      await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantityOnHand: newQty },
      });

      await tx.inventoryLog.create({
        data: {
          inventoryId: inventory.id,
          productId: item.productId,
          userId,
          movementType: "OUT",
          quantity: item.quantity,
          previousQty,
          newQty,
          reason: `Stock Out from Sale ${data.saleCode}`,
          reference: data.saleCode,
        },
      });
    }

    return sale;
  });
}

// Header columns only; see `SaleUpdateSchema` for why lines are not editable.
// The legacy update ran `updateMany({ where: { id } })` with no organization
// filter, so any member could rewrite any tenant's invoice.
export async function updateSale(
  id: string,
  data: SaleUpdateInput,
  organizationId: string
) {
  const updateData: Prisma.SaleUncheckedUpdateInput = { ...data };

  return prisma.sale.update({
    where: { id, organizationId },
    data: updateData,
    include: detailInclude,
  });
}

// Deleting a sale does not return the stock it consumed, and moving a sale to
// "Cancelled" does not either. The legacy delete behaved the same way. Both need
// a reversal flow, which this checkpoint does not invent.
export async function deleteSale(id: string, organizationId: string) {
  await prisma.sale.delete({ where: { id, organizationId } });
}
