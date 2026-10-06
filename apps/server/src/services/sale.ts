import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
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
 * not part of this one either.
 */
export const calculateSaleTotal = (data: SaleInvoiceInput) => {
  const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const gstTax = (data.cgstAmount ?? 0) + (data.sgstAmount ?? 0) + (data.igstAmount ?? 0);
  const tax = data.taxAmount ?? (gstTax > 0 ? gstTax : 0);
  return subtotal + tax - (data.discount ?? 0);
};

export interface SaleBreakdownItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  productName?: string;
  productCode?: string;
  gstApplicable?: boolean;
  gstRate?: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

export interface SaleBreakdownResult {
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  discount: number;
  total: number;
  items: SaleBreakdownItem[];
}

export function calculateSaleBreakdown(params: {
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal?: number;
    gstApplicable?: boolean;
    gstRate?: number;
    taxPercent?: number;
    cgstRate?: number;
    sgstRate?: number;
    igstRate?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    productName?: string;
    productCode?: string;
  }>;
  isInterState?: boolean;
  discount?: number;
  taxAmount?: number;
}): SaleBreakdownResult {
  const isInterState = Boolean(params.isInterState);
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let subtotal = 0;

  const items: SaleBreakdownItem[] = params.items.map((item) => {
    const lineTotal = item.subtotal ?? item.quantity * item.unitPrice;
    subtotal += lineTotal;
    const isGstApplicable = item.gstApplicable ?? true;
    const rawRate = isGstApplicable ? (item.taxPercent ?? item.gstRate ?? 0) : 0;

    let cgstRate = item.cgstRate ?? 0;
    let sgstRate = item.sgstRate ?? 0;
    let igstRate = item.igstRate ?? 0;
    let cgstAmount = item.cgstAmount ?? 0;
    let sgstAmount = item.sgstAmount ?? 0;
    let igstAmount = item.igstAmount ?? 0;

    if (rawRate > 0 && !item.cgstRate && !item.sgstRate && !item.igstRate && !item.cgstAmount && !item.sgstAmount && !item.igstAmount) {
      if (isInterState) {
        igstRate = rawRate;
        igstAmount = Number(((lineTotal * igstRate) / 100).toFixed(2));
      } else {
        cgstRate = Number((rawRate / 2).toFixed(2));
        sgstRate = Number((rawRate / 2).toFixed(2));
        cgstAmount = Number(((lineTotal * cgstRate) / 100).toFixed(2));
        sgstAmount = Number(((lineTotal * sgstRate) / 100).toFixed(2));
      }
    }

    totalCgst += cgstAmount;
    totalSgst += sgstAmount;
    totalIgst += igstAmount;

    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: lineTotal,
      productName: item.productName,
      productCode: item.productCode,
      gstApplicable: item.gstApplicable,
      gstRate: item.gstRate,
      cgstRate,
      sgstRate,
      igstRate,
      cgstAmount,
      sgstAmount,
      igstAmount,
    };
  });

  const cgstAmount = Number(totalCgst.toFixed(2));
  const sgstAmount = Number(totalSgst.toFixed(2));
  const igstAmount = Number(totalIgst.toFixed(2));
  const totalTax = params.taxAmount !== undefined ? params.taxAmount : Number((cgstAmount + sgstAmount + igstAmount).toFixed(2));
  const discount = params.discount ?? 0;
  const total = Number((subtotal + totalTax - discount).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount: totalTax,
    discount,
    total,
    items,
  };
}

export type SaleListArgs = {
  organizationId: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: SaleInvoiceInput["status"];
  /** `true` for the Deleted tab; absent means active invoices only. */
  deleted?: boolean;
};

/** Total units of one product across every line, so repeats are checked together. */
const demandByProduct = (lines: { productId: string; quantity: number }[]) => {
  const demand = new Map<string, number>();
  for (const line of lines) {
    demand.set(line.productId, (demand.get(line.productId) ?? 0) + line.quantity);
  }
  return demand;
};

export async function getSales({
  organizationId,
  page,
  pageSize,
  search,
  status,
  deleted,
}: SaleListArgs) {
  const where: Prisma.SaleWhereInput = {
    organizationId,
    // The Deleted tab asks for the soft-deleted invoices explicitly; every other
    // caller sees active invoices only, as before.
    deletedAt: deleted ? { not: null } : null,
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
  // Soft-deleted invoices are out of circulation: a customer's history (and the
  // Payments page that picks invoices to settle) shows active invoices only.
  const where: Prisma.SaleWhereInput = { customerId, organizationId, deletedAt: null };

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

    const productIds = [...demandByProduct(data.items).keys()];
    const owned = await tx.product.findMany({
      where: { id: { in: productIds }, organizationId },
      select: { id: true, gstApplicable: true, gstRate: true },
    });

    if (owned.length !== productIds.length) {
      const ownedIds = new Set(owned.map((product) => product.id));
      throw badRequest(
        "One or more products do not exist in this organization",
        "PRODUCT_NOT_IN_ORGANIZATION",
        { productIds: productIds.filter((id) => !ownedIds.has(id)) }
      );
    }

    const productMap = new Map(owned.map((product) => [product.id, product]));
    const isInterState = Boolean(data.isInterState);
    let totalCgstAmount = 0;
    let totalSgstAmount = 0;
    let totalIgstAmount = 0;

    const saleItems = data.items.map((item) => {
      const prod = productMap.get(item.productId);
      const isGstApplicable = prod?.gstApplicable ?? true;
      const rawRate = isGstApplicable ? (item.taxPercent ?? prod?.gstRate ?? 0) : 0;
      const lineTotal = item.quantity * item.unitPrice;

      let cgstRate = item.cgstRate ?? 0;
      let sgstRate = item.sgstRate ?? 0;
      let igstRate = item.igstRate ?? 0;
      let cgstAmount = item.cgstAmount ?? 0;
      let sgstAmount = item.sgstAmount ?? 0;
      let igstAmount = item.igstAmount ?? 0;

      if (rawRate > 0 && !item.cgstRate && !item.sgstRate && !item.igstRate && !item.cgstAmount && !item.sgstAmount && !item.igstAmount) {
        if (isInterState) {
          igstRate = rawRate;
          igstAmount = Number(((lineTotal * igstRate) / 100).toFixed(2));
        } else {
          cgstRate = Number((rawRate / 2).toFixed(2));
          sgstRate = Number((rawRate / 2).toFixed(2));
          cgstAmount = Number(((lineTotal * cgstRate) / 100).toFixed(2));
          sgstAmount = Number(((lineTotal * sgstRate) / 100).toFixed(2));
        }
      }

      totalCgstAmount += cgstAmount;
      totalSgstAmount += sgstAmount;
      totalIgstAmount += igstAmount;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: lineTotal,
        taxPercent: rawRate > 0 ? rawRate : item.taxPercent,
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount,
        sgstAmount,
        igstAmount,
      };
    });

    const calculatedCgst = data.cgstAmount !== undefined ? data.cgstAmount : Number(totalCgstAmount.toFixed(2));
    const calculatedSgst = data.sgstAmount !== undefined ? data.sgstAmount : Number(totalSgstAmount.toFixed(2));
    const calculatedIgst = data.igstAmount !== undefined ? data.igstAmount : Number(totalIgstAmount.toFixed(2));
    const totalGst = calculatedCgst + calculatedSgst + calculatedIgst;
    const finalTaxAmount = data.taxAmount !== undefined ? data.taxAmount : (totalGst > 0 || data.invoiceType === "tax" ? totalGst : undefined);
    const subtotal = data.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
    const finalTotalAmount = data.taxAmount !== undefined ? totalAmount : (subtotal + (finalTaxAmount ?? 0) - (data.discount ?? 0));

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

    for (const [productId, requested] of demandByProduct(data.items)) {
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
        totalAmount: finalTotalAmount,
        discount: data.discount,
        taxAmount: finalTaxAmount,
        invoiceType: data.invoiceType ?? "regular",
        isInterState,
        cgstAmount: calculatedCgst,
        sgstAmount: calculatedSgst,
        igstAmount: calculatedIgst,
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

      // FEFO (First Expired, First Out) batch deduction
      if (typeof (tx as any).stockBatch?.findMany === "function") {
        const availableBatches = await tx.stockBatch.findMany({
          where: {
            productId: item.productId,
            organizationId,
            quantityRemaining: { gt: 0 },
          },
          orderBy: [
            { expiryDate: "asc" },
            { receivedAt: "asc" },
          ],
        });

        let remainingToDeduct = item.quantity;
        for (const batch of availableBatches) {
          if (remainingToDeduct <= 0) break;
          const deduct = Math.min(batch.quantityRemaining, remainingToDeduct);
          await tx.stockBatch.update({
            where: { id: batch.id },
            data: { quantityRemaining: { decrement: deduct } },
          });
          remainingToDeduct -= deduct;
        }
      }
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

  // Cancel and un-cancel are guarded contracts, not free-form status edits:
  // the endpoints refuse invoices with payments or returns and remember the
  // status they came from. A PUT that could set `Cancelled` directly would be a
  // second, unguarded way past exactly those checks.
  if (data.status !== undefined) {
    const current = await prisma.sale.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { status: true },
    });

    if (current) {
      if (data.status === "Cancelled") {
        throw badRequest(
          "Cancel an invoice through POST /api/sales/:id/cancel, which checks " +
            "for payments and returns first",
          "USE_CANCEL_ENDPOINT"
        );
      }

      if (current.status === "Cancelled") {
        throw conflict(
          "This invoice is cancelled. Un-cancel it through POST /api/sales/:id/uncancel first",
          "SALE_IS_CANCELLED",
          { status: current.status }
        );
      }
    }
  }

  const updateData: Prisma.SaleUncheckedUpdateInput = { ...data };

  // A soft-deleted invoice is out of circulation: its stock has been given
  // back, so rewriting its header would edit a document nothing matches
  // anymore. Restore it first.
  return prisma.sale.update({
    where: { id, organizationId, deletedAt: null },
    data: updateData,
    include: detailInclude,
  });
}

/**
 * Soft delete: give the stock back, stamp `deletedAt`, keep the document.
 *
 * The legacy delete removed the row and returned nothing — the comment that sat
 * here said a reversal flow "this checkpoint does not invent". Checkpoint 14
 * invents it, because a deleted invoice whose stock never came back leaves
 * `quantityOnHand` disagreeing with every document that exists.
 *
 * Three guards run before anything moves, all inside one `Serializable`
 * transaction so a concurrent payment or return cannot slip past them:
 *
 * - **Payments.** An invoice with money against it cannot vanish: the payment
 *   would become a credit with no invoice it was ever applied to. Correct the
 *   payments first (a payment soft-deletes too), then the invoice.
 * - **Returns.** A SALE return is held to this invoice's lines. Deleting the
 *   invoice underneath an active return would strand the return on a document
 *   that no longer claims to have sold anything.
 * - **Cancelled invoices reverse nothing.** Cancelling already left the stock
 *   where it is, so this is the one path where the reversal is real work rather
 *   than bookkeeping — see below.
 *
 * The reversal itself is an increase, so it needs no availability guard: the
 * sale took these units out, and they are either in the warehouse or they are
 * not, but putting them back can never go negative.
 */
export async function deleteSale(id: string, organizationId: string, userId: string) {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.sale.findFirst({
        where: { id, organizationId },
        include: { items: { select: { productId: true, quantity: true } } },
      });

      if (!existing) {
        throw notFound("Sale not found", "SALE_NOT_FOUND");
      }

      if (existing.deletedAt) {
        throw conflict("This invoice has already been deleted", "SALE_ALREADY_DELETED", {
          id: existing.id,
          saleCode: existing.saleCode,
        });
      }

      if (existing.amountPaid > 0) {
        throw conflict(
          "This invoice has payments recorded against it. Correct them first, " +
            "then delete the invoice.",
          "SALE_HAS_PAYMENTS",
          { saleCode: existing.saleCode, amountPaid: existing.amountPaid }
        );
      }

      const activeReturns = await tx.return.count({
        where: { saleId: existing.id, organizationId, deletedAt: null },
      });

      if (activeReturns > 0) {
        throw conflict(
          "Returns have been recorded against this invoice. Delete those first, " +
            "then delete the invoice.",
          "SALE_HAS_RETURNS",
          { saleCode: existing.saleCode, returns: activeReturns }
        );
      }

      for (const [productId, quantity] of demandByProduct(existing.items)) {
        const row = await tx.inventory.findFirst({
          where: { productId, organizationId },
          select: { id: true, quantityOnHand: true },
        });

        if (!row) {
          throw conflict("The stock record no longer exists", "INVENTORY_ROW_MISSING", {
            productId,
          });
        }

        const updated = await tx.inventory.update({
          where: { id: row.id, organizationId },
          data: { quantityOnHand: { increment: quantity } },
          select: { quantityOnHand: true },
        });

        await tx.inventoryLog.create({
          data: {
            inventoryId: row.id,
            productId,
            userId,
            movementType: "IN",
            quantity,
            previousQty: updated.quantityOnHand - quantity,
            newQty: updated.quantityOnHand,
            reason: `Reversal of sale ${existing.saleCode}`,
            reference: existing.saleCode,
          },
        });
      }

      return tx.sale.update({
        where: { id, organizationId },
        data: { deletedAt: new Date() },
        include: detailInclude,
      });
    },
    { isolationLevel: "Serializable" }
  );
}

/**
 * Undo a soft delete: re-consume the stock the delete gave back, then clear
 * `deletedAt`.
 *
 * This is the direction that can fail. The sale is asking for units back out of
 * the warehouse, and they may have been sold on since — the guarded decrement
 * refuses rather than clamps, exactly like `createSale`, so a restore can never
 * drive `quantityOnHand` negative or write a ledger row whose arithmetic does
 * not hold.
 */
export async function restoreSale(id: string, organizationId: string, userId: string) {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.sale.findFirst({
        where: { id, organizationId },
        include: { items: { select: { productId: true, quantity: true } } },
      });

      if (!existing) {
        throw notFound("Sale not found", "SALE_NOT_FOUND");
      }

      if (!existing.deletedAt) {
        throw conflict("This invoice is not deleted", "SALE_NOT_DELETED", {
          id: existing.id,
          saleCode: existing.saleCode,
        });
      }

      for (const [productId, quantity] of demandByProduct(existing.items)) {
        const claimed = await tx.inventory.updateMany({
          where: {
            productId,
            organizationId,
            quantityOnHand: { gte: quantity },
          },
          data: { quantityOnHand: { decrement: quantity } },
        });

        if (claimed.count === 0) {
          const current = await tx.inventory.findFirst({
            where: { productId, organizationId },
            select: { quantityOnHand: true },
          });

          if (!current) {
            throw conflict("The stock record no longer exists", "INVENTORY_ROW_MISSING", {
              productId,
            });
          }

          throw conflict(
            "There is no longer enough stock on hand to re-apply this invoice, " +
              "so it cannot be restored",
            "INSUFFICIENT_STOCK_FOR_RESTORE",
            { productId, available: current.quantityOnHand, requested: quantity }
          );
        }

        const current = await tx.inventory.findFirstOrThrow({
          where: { productId, organizationId },
          select: { id: true, quantityOnHand: true },
        });

        await tx.inventoryLog.create({
          data: {
            inventoryId: current.id,
            productId,
            userId,
            movementType: "OUT",
            quantity,
            previousQty: current.quantityOnHand + quantity,
            newQty: current.quantityOnHand,
            reason: `Restoration of sale ${existing.saleCode}`,
            reference: existing.saleCode,
          },
        });
      }

      return tx.sale.update({
        where: { id, organizationId },
        data: { deletedAt: null },
        include: detailInclude,
      });
    },
    { isolationLevel: "Serializable" }
  );
}

/**
 * Cancel an invoice without touching stock — cancelling never has, and that is
 * the point of it as distinct from deleting: cancel keeps the goods out of the
 * warehouse (the sale still happened) while taking the document out of
 * circulation. `statusBeforeCancel` remembers what it was, so un-cancel is an
 * exact undo rather than a guess.
 *
 * Refused while money is against it, for the same reason deletion is: a
 * cancelled invoice nothing can settle would strand the payments.
 */
export async function cancelSale(id: string, organizationId: string) {
  const existing = await prisma.sale.findFirst({
    where: { id, organizationId, deletedAt: null },
    select: { id: true, saleCode: true, status: true, amountPaid: true },
  });

  if (!existing) {
    throw notFound("Sale not found", "SALE_NOT_FOUND");
  }

  if (existing.status === "Cancelled") {
    throw conflict("This invoice is already cancelled", "SALE_ALREADY_CANCELLED", {
      saleCode: existing.saleCode,
    });
  }

  if (existing.amountPaid > 0) {
    throw conflict(
      "This invoice has payments recorded against it. Correct them first, " +
        "then cancel the invoice.",
      "SALE_HAS_PAYMENTS",
      { saleCode: existing.saleCode, amountPaid: existing.amountPaid }
    );
  }

  // A cancelled invoice that still carries returns would leave the customer's
  // goods credited against a document that never happened. Same refusal the
  // delete gives, for the same reason.
  const activeReturns = await prisma.return.count({
    where: { saleId: existing.id, organizationId, deletedAt: null },
  });

  if (activeReturns > 0) {
    throw conflict(
      "Returns have been recorded against this invoice. Delete those first, " +
        "then cancel the invoice.",
      "SALE_HAS_RETURNS",
      { saleCode: existing.saleCode, returns: activeReturns }
    );
  }

  return prisma.sale.update({
    where: { id, organizationId },
    data: { status: "Cancelled", statusBeforeCancel: existing.status },
    include: detailInclude,
  });
}

/**
 * Un-cancel. Stock was never touched by the cancel, so nothing is re-applied
 * and no availability check is needed — the asymmetry with `restoreSale` is
 * what makes cancel the cheap operation and delete the expensive one.
 */
export async function uncancelSale(id: string, organizationId: string) {
  const existing = await prisma.sale.findFirst({
    where: { id, organizationId, deletedAt: null },
    select: { id: true, saleCode: true, status: true, statusBeforeCancel: true },
  });

  if (!existing) {
    throw notFound("Sale not found", "SALE_NOT_FOUND");
  }

  if (existing.status !== "Cancelled") {
    throw conflict("This invoice is not cancelled", "SALE_NOT_CANCELLED", {
      saleCode: existing.saleCode,
      status: existing.status,
    });
  }

  return prisma.sale.update({
    where: { id, organizationId },
    data: { status: existing.statusBeforeCancel ?? "Pending", statusBeforeCancel: null },
    include: detailInclude,
  });
}

export async function getSaleInvoiceData(id: string, organizationId: string) {
  const sale = await getSaleByIdOrCode(id, organizationId);
  if (!sale) return null;

  const items = sale.items || [];
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const totalTax =
    (sale.cgstAmount || 0) + (sale.sgstAmount || 0) + (sale.igstAmount || 0) ||
    (sale.taxAmount || 0);

  return {
    ...sale,
    subtotal,
    totalTax,
    items: items.map((it) => ({
      ...it,
      totalPrice: it.totalPrice ?? it.quantity * it.unitPrice,
    })),
  };
}
