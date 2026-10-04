import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import { calculateSaleTotal } from "@dms/shared";
import type { SaleInvoiceInput, SaleUpdateInput } from "@dms/shared";
import { badRequest, conflict, notFound } from "../http/errors";

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
 * not part of this one either. Shared with the invoice form's live total; see
 * `@dms/shared` totals.ts.
 */
export { calculateSaleTotal };

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
// id from another tenant returned their whole sales history. Scoped here, and
// paginated like `getSales`: a customer's lifetime result set is unbounded, and
// each row embeds its lines and their products.
export type SaleCustomerListArgs = {
  customerId: string;
  organizationId: string;
  page: number;
  pageSize: number;
};

export async function getSalesByCustomer({
  customerId,
  organizationId,
  page,
  pageSize,
}: SaleCustomerListArgs) {
  const where: Prisma.SaleWhereInput = { customerId, organizationId };

  const [data, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: detailInclude,
      orderBy: { saleDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sale.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
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
    // This pass is for the error message, not for the guarantee. It reports every
    // short line at once instead of failing on the first, but the decision that
    // actually protects stock is the guarded decrement in the loop below, which
    // runs against the row as the database sees it. Relying on this read alone
    // would leave a window between the check and the write.
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
      // The availability check and the write are one statement, and that is the
      // only part that has to be. A read-then-write pair cannot hold under READ
      // COMMITTED: two concurrent sales of 8 against 10 on hand both pass a
      // pre-check, both read 10, and both write 2, so 16 units are sold against
      // 2 left. The `gte` guard is evaluated by the database against the row it
      // is updating, so only one transaction can claim the units and the other
      // is refused. Two lines for the same product still deduct in sequence,
      // because each one sees the previous line's write.
      const claimed = await tx.inventory.updateMany({
        where: {
          productId: item.productId,
          organizationId,
          quantityOnHand: { gte: item.quantity },
        },
        data: { quantityOnHand: { decrement: item.quantity } },
      });

      if (claimed.count === 0) {
        // The pre-pass above already refused a product with no inventory row,
        // but it ran as a separate read, so a concurrent transaction may have
        // taken the units, or deleted the row, since.
        const current = await tx.inventory.findFirst({
          where: { productId: item.productId, organizationId },
          select: { quantityOnHand: true },
        });

        if (!current) {
          throw conflict(
            "The stock record for one of the products no longer exists",
            "INVENTORY_ROW_MISSING",
            { productId: item.productId }
          );
        }

        throw conflict(
          "Not enough stock to fulfil this sale",
          "INSUFFICIENT_STOCK",
          {
            shortages: [
              {
                productId: item.productId,
                available: current.quantityOnHand,
                requested: item.quantity,
              },
            ],
          }
        );
      }

      // `updateMany` returns a count, not a row, so the ledger's opening figure
      // is derived from the row as it stands after the write rather than read
      // before it: previousQty - quantity = newQty holds by construction.
      const current = await tx.inventory.findFirst({
        where: { productId: item.productId, organizationId },
        select: { id: true, quantityOnHand: true },
      });

      if (!current) {
        throw conflict(
          "The stock record for one of the products no longer exists",
          "INVENTORY_ROW_MISSING",
          { productId: item.productId }
        );
      }

      const newQty = current.quantityOnHand;
      const previousQty = newQty + item.quantity;

      await tx.inventoryLog.create({
        data: {
          inventoryId: current.id,
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
  // `Sale.customerId` is a plain foreign key with no organization constraint,
  // so the database would let a PUT re-point the invoice at another tenant's
  // customer. `createSale` refuses exactly this above, and the update path has
  // to refuse it too.
  if (data.customerId !== undefined) {
    const customer = await prisma.customer.findFirst({
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
  }

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
/**
 * Delete an invoice and put its stock back, in one transaction.
 *
 * The legacy delete removed the invoice and left the units it sold missing
 * from `Inventory.quantityOnHand`, so a voided invoice permanently understated
 * stock. Each line is now returned with an `IN` movement naming the invoice.
 *
 * Refused (409) when a return already references the invoice: those units
 * came back through the return, and deleting the invoice as well would put
 * them back twice.
 */
export async function deleteSale(id: string, organizationId: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id, organizationId },
      include: { items: true, _count: { select: { returns: true } } },
    });
    if (!sale) throw notFound("Sale not found", "SALE_NOT_FOUND");

    if (sale._count.returns > 0) {
      throw conflict(
        "This invoice has returns recorded against it and cannot be deleted.",
        "SALE_HAS_RETURNS"
      );
    }

    for (const item of sale.items) {
      const inventory = await tx.inventory.upsert({
        where: { productId: item.productId },
        update: { quantityOnHand: { increment: item.quantity } },
        create: { productId: item.productId, organizationId, quantityOnHand: item.quantity },
      });
      await tx.inventoryLog.create({
        data: {
          inventoryId: inventory.id,
          productId: item.productId,
          userId,
          movementType: "IN",
          quantity: item.quantity,
          previousQty: inventory.quantityOnHand - item.quantity,
          newQty: inventory.quantityOnHand,
          reason: `Sale ${sale.saleCode} deleted`,
          reference: sale.saleCode,
        },
      });
    }

    await tx.sale.delete({ where: { id: sale.id } });
  });
}
