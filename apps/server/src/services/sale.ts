import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import {
  calculateSaleBreakdown,
  isInvalidSaleTotal,
  type SaleInvoiceInput,
  type SaleUpdateInput,
} from "@dms/shared";
import { badRequest, conflict, notFound } from "../http/errors";
import { applyStockMovement } from "./stock-movement";

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
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.saleCode = { contains: search, mode: "insensitive" };
  }

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
  const sale = await prisma.sale.findFirst({
    where: { organizationId, OR: [{ id: idOrCode }, { saleCode: idOrCode }] },
    include: detailInclude,
  });

  if (!sale) {
    throw notFound("Sale not found", "SALE_NOT_FOUND");
  }

  return sale;
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
  // The document's money figures are derived before the transaction opens, for
  // two reasons. A line's GST rate falls back to its product's rate, so the
  // products have to be read first; and the invalid-total refusal has to run
  // before `$transaction` starts, so a document that cannot be written never
  // opens one. The same figures are stored below, so what is refused here and
  // what is written there are one calculation, not two.
  const productIds = [...demandByProduct(data.items).keys()];

  const owned = await prisma.product.findMany({
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

  const money = calculateSaleBreakdown({
    items: data.items.map((item) => {
      const product = productMap.get(item.productId);

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstApplicable: product?.gstApplicable,
        gstRate: product?.gstRate,
        taxPercent: item.taxPercent,
        cgstRate: item.cgstRate,
        sgstRate: item.sgstRate,
        igstRate: item.igstRate,
        cgstAmount: item.cgstAmount,
        sgstAmount: item.sgstAmount,
        igstAmount: item.igstAmount,
      };
    }),
    isInterState,
    discount: data.discount,
    taxAmount: data.taxAmount,
    cgstAmount: data.cgstAmount,
    sgstAmount: data.sgstAmount,
    igstAmount: data.igstAmount,
  });

  if (isInvalidSaleTotal(money.total)) {
    throw badRequest(
      "Sale total cannot be negative. Check the discount and tax amounts.",
      "INVALID_TOTAL",
      { totalAmount: money.total }
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

    // The line rows come from the breakdown that was already checked: the line
    // subtotal becomes `totalPrice`, and the stored rate is the one actually
    // applied — the product's rate when the line stated none, else the line's.
    const saleItems = money.items.map((line, index) => {
      const item = data.items[index];

      return {
        productId: item.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        totalPrice: line.subtotal,
        taxPercent: line.taxPercent > 0 ? line.taxPercent : item.taxPercent,
        cgstRate: line.cgstRate,
        sgstRate: line.sgstRate,
        igstRate: line.igstRate,
        cgstAmount: line.cgstAmount,
        sgstAmount: line.sgstAmount,
        igstAmount: line.igstAmount,
      };
    });

    // The legacy service deducted optimistically and clamped at zero:
    // `quantityOnHand: Math.max(0, newQty)` with only a `console.warn`. Selling
    // 10 of 5 in stock left 0 on hand and still logged an `OUT` of 10 whose own
    // previousQty/newQty pair said only 5 had moved. This refuses the document
    // instead, so the log always satisfies previousQty - quantity = newQty.
    //
    // This pass is for the error message, not for the guarantee. It reports every
    // short line at once instead of failing on the first, but the decision that
    // actually protects stock is the guarded decrement inside the stock-movement
    // module below, which runs against the row as the database sees it. Relying
    // on this read alone would leave a window between the check and the write.
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

    // The movements run before the invoice row because a sale line records the
    // lot its units were drawn from (`SaleItem.batchId`), and the batch is only
    // known once the deduction has taken it. The availability decision itself
    // lives in the stock-movement module: two lines for the same product still
    // deduct in sequence, because each one sees the previous line's write.
    const batchIds: (string | null)[] = [];

    for (const item of data.items) {
      const { batchId } = await applyStockMovement({
        tx,
        organizationId,
        userId,
        productId: item.productId,
        direction: "out",
        quantity: item.quantity,
        movementType: "OUT",
        reason: `Stock Out from Sale ${data.saleCode}`,
        reference: data.saleCode,
        refusal: (available) =>
          conflict("Not enough stock to fulfil this sale", "INSUFFICIENT_STOCK", {
            shortages: [{ productId: item.productId, available, requested: item.quantity }],
          }),
      });

      batchIds.push(batchId);
    }

    const sale = await tx.sale.create({
      data: {
        saleCode: data.saleCode,
        customerId: data.customerId,
        saleDate: data.saleDate,
        totalAmount: money.total,
        discount: data.discount,
        taxAmount: money.taxAmount,
        invoiceType: data.invoiceType ?? "regular",
        isInterState,
        cgstAmount: money.cgstAmount,
        sgstAmount: money.sgstAmount,
        igstAmount: money.igstAmount,
        status: data.status,
        organizationId,
        items: {
          create: saleItems.map((line, index) => ({ ...line, batchId: batchIds[index] })),
        },
      },
      include: detailInclude,
    });

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
        // Giving stock back never refuses, and the batches the invoice
        // consumed are credited as it comes — the stock-movement module owns
        // both the ledger row and that consequence.
        await applyStockMovement({
          tx,
          organizationId,
          userId,
          productId,
          direction: "in",
          quantity,
          movementType: "IN",
          reason: `Reversal of sale ${existing.saleCode}`,
          reference: existing.saleCode,
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
        await applyStockMovement({
          tx,
          organizationId,
          userId,
          productId,
          direction: "out",
          quantity,
          movementType: "OUT",
          reason: `Restoration of sale ${existing.saleCode}`,
          reference: existing.saleCode,
          refusal: (available) =>
            conflict(
              "There is no longer enough stock on hand to re-apply this invoice, " +
                "so it cannot be restored",
              "INSUFFICIENT_STOCK_FOR_RESTORE",
              { productId, available, requested: quantity }
            ),
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

  const items = sale.items || [];

  // The read path asks the same module the write path used, fed with the
  // figures as they are stored: each line passes its stored subtotal and split
  // through untouched, and the header's own tax wins exactly as it did on the
  // way in. Nothing is re-derived from rates that could have changed since.
  const money = calculateSaleBreakdown({
    items: items.map((it) => ({
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      subtotal: it.totalPrice ?? it.quantity * it.unitPrice,
      cgstRate: it.cgstRate ?? 0,
      sgstRate: it.sgstRate ?? 0,
      igstRate: it.igstRate ?? 0,
      cgstAmount: it.cgstAmount ?? 0,
      sgstAmount: it.sgstAmount ?? 0,
      igstAmount: it.igstAmount ?? 0,
    })),
    discount: sale.discount ?? undefined,
    taxAmount: sale.taxAmount ?? undefined,
    cgstAmount: sale.cgstAmount ?? undefined,
    sgstAmount: sale.sgstAmount ?? undefined,
    igstAmount: sale.igstAmount ?? undefined,
  });

  return {
    ...sale,
    subtotal: money.subtotal,
    totalTax: money.taxAmount,
    items: items.map((it, index) => ({
      ...it,
      totalPrice: money.items[index].subtotal,
    })),
  };
}
