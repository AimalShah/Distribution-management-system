import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type {
  ReturnCreateInput,
  ReturnListQuery,
  ReturnTypeValue,
  ReturnUpdateInput,
} from "@dms/shared";
import { badRequest, conflict, notFound } from "../http/errors";

/**
 * The legacy list embedded every line with its product, so one row carried an
 * unbounded payload once paging is added. The count is sent instead and the lines
 * stay on the detail route, as with sales and purchases.
 */
const listInclude = {
  user: { select: { name: true, email: true } },
  _count: { select: { items: true } },
} satisfies Prisma.ReturnInclude;

const detailInclude = {
  user: { select: { name: true, email: true } },
  items: { include: { product: true } },
  // The linked document's code, so a row can say what the return is reversing
  // without the client making a second request per row.
  sale: { select: { id: true, saleCode: true } },
  purchase: { select: { id: true, purchaseCode: true } },
} satisfies Prisma.ReturnInclude;

/**
 * A SALE return is a customer handing goods back, so the stock comes in.
 * Everything else is stock leaving the building: a PURCHASE return goes back out
 * to the supplier, and EXPIRED/DAMAGED are write-offs.
 *
 * The legacy `addReturn` moved no stock at all in any direction. The
 * `source-review.md` shipped with this checkpoint claimed it did, and that claim
 * was the only trace of the behaviour anywhere in the codebase.
 */
const movesStockIn = (returnType: ReturnTypeValue) => returnType === "SALE";

/**
 * The `InventoryLog.movementType` a return writes. These are the same four
 * values `services/inventory.ts` already classifies, so a return's ledger rows
 * read exactly like a manual adjustment of the same effect and a stock
 * reconciliation does not have to special-case returns.
 */
const movementTypeFor = (
  returnType: ReturnTypeValue
): "RETURN" | "OUT" | "EXPIRED" | "DAMAGED" => {
  switch (returnType) {
    case "SALE":
      return "RETURN";
    case "PURCHASE":
      return "OUT";
    case "EXPIRED":
      return "EXPIRED";
    case "DAMAGED":
      return "DAMAGED";
  }
};

const labelFor = (returnType: ReturnTypeValue) =>
  ({
    SALE: "Sale return",
    PURCHASE: "Purchase return",
    EXPIRED: "Expired stock write-off",
    DAMAGED: "Damaged stock write-off",
  })[returnType];

/** Total units of one product across every line, so repeats are checked together. */
const sumByProduct = (lines: { productId: string; quantity: number }[]) => {
  const totals = new Map<string, number>();
  for (const line of lines) {
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
  }
  return totals;
};

/**
 * The transaction-scoped client `prisma.$transaction` hands to its callback.
 *
 * `Prisma.TransactionClient` is the bare client's version of this and is not
 * interchangeable here: the shared client is extended with a query logger, so an
 * interactive transaction hands back the extended shape and the two do not
 * structurally match.
 */
type TransactionTx = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Moves one product's stock and hands back the pair the ledger needs.
 *
 * The tenant is a separate argument rather than a field read off `target`,
 * because `target` comes from a `select` that only asks for the columns the
 * caller happens to need. A scope of `{ id, organizationId: undefined }` matches
 * any tenant's row, so the filter has to be something the caller cannot forget to
 * carry.
 *
 * The new quantity is never computed from a read and written back. That pattern
 * cannot hold under READ COMMITTED: with 10 on hand, a concurrent inbound and
 * outbound return of the same product would both read 10, then both write their
 * own answer, so 20 units pass through the row and the two log entries describe
 * movements that never happened against each other. Each direction is instead a
 * single statement the database evaluates against the row it is updating, so the
 * quantity on hand and the log entry describing it can never disagree.
 *
 * An increase is plain arithmetic. A decrease is a guarded decrement: the `gte`
 * guard and the decrement are the same statement, so only one transaction can
 * claim the units, and `count === 0` means this caller did not get them. The
 * follow-up read is what tells a genuine shortage apart from a row a concurrent
 * transaction deleted.
 */
async function applyStockMovement(
  tx: TransactionTx,
  target: { id: string },
  organizationId: string,
  direction: "in" | "out",
  quantity: number,
  shortage: { code: string; message: string }
): Promise<{ previousQty: number; newQty: number }> {
  const scope = { id: target.id, organizationId } as const;

  if (direction === "in") {
    const updated = await tx.inventory.update({
      where: scope,
      data: { quantityOnHand: { increment: quantity } },
      select: { quantityOnHand: true },
    });

    return { previousQty: updated.quantityOnHand - quantity, newQty: updated.quantityOnHand };
  }

  const claimed = await tx.inventory.updateMany({
    where: { ...scope, quantityOnHand: { gte: quantity } },
    data: { quantityOnHand: { decrement: quantity } },
  });

  if (claimed.count === 0) {
    const current = await tx.inventory.findFirst({
      where: scope,
      select: { quantityOnHand: true },
    });

    if (!current) {
      throw conflict("The stock record no longer exists", "INVENTORY_ROW_MISSING", {
        inventoryId: target.id,
      });
    }

    // Refuse rather than clamp. Clamping at zero, as the legacy inventory
    // service did, records a movement of 10 against a change of 5 and the
    // shortfall simply disappears.
    throw conflict(shortage.message, shortage.code, {
      available: current.quantityOnHand,
      requested: quantity,
    });
  }

  // `updateMany` returns a count rather than a row, so the opening figure is
  // read back off the row as it stands after the write. That keeps the ledger's
  // arithmetic true by construction even when another transaction committed
  // between the scope read and this write.
  const current = await tx.inventory.findFirstOrThrow({
    where: scope,
    select: { quantityOnHand: true },
  });

  return { previousQty: current.quantityOnHand + quantity, newQty: current.quantityOnHand };
}

export async function getReturns({
  organizationId,
  page,
  pageSize,
  search,
  returnType,
}: ReturnListQuery & { organizationId: string }) {
  const where: Prisma.ReturnWhereInput = {
    organizationId,
    ...(returnType ? { returnType } : {}),
    ...(search ? { returnCode: { contains: search, mode: "insensitive" } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.return.findMany({
      where,
      include: listInclude,
      orderBy: { returnDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.return.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

/**
 * `:id` matches either the cuid or the human readable `returnCode`, which is the
 * union of the two ways the legacy `fetchReturn` was called.
 *
 * The legacy lookup was `findMany({ where: { id } })` with no organization
 * filter, and it returned an array for a detail route. It leaked any tenant's
 * return to anyone who could guess an id, and the caller had to unwrap a list to
 * read one record.
 */
export async function getReturnByIdOrCode(idOrCode: string, organizationId: string) {
  return prisma.return.findFirst({
    where: { organizationId, OR: [{ id: idOrCode }, { returnCode: idOrCode }] },
    include: detailInclude,
  });
}

type DocumentLine = { productId: string; quantity: number };

/**
 * Holds a SALE or PURCHASE return to the document it reverses.
 *
 * `Return.saleId`/`.purchaseId` are the columns the legacy form already collected
 * and the legacy service already discarded. With them set, a return can finally
 * be held to its document: every line has to name a product that was actually on
 * it, and the quantity being returned now plus everything already returned
 * against that document cannot exceed what the document moved.
 *
 * Without the second rule, a SALE return of one unit against a ten unit sale
 * could be posted ten times over and put a hundred units of stock on hand that
 * never arrived.
 */
function assertQuantitiesFit({
  requested,
  documentLines,
  alreadyReturned,
  documentLabel,
  documentCode,
  reference,
}: {
  requested: Map<string, number>;
  documentLines: DocumentLine[];
  alreadyReturned: Map<string, number>;
  documentLabel: "sale" | "purchase";
  documentCode: string;
  reference: { saleId?: string; purchaseId?: string };
}) {
  const onDocument = sumByProduct(documentLines);

  const notOnDocument = [...requested.keys()].filter(
    (productId) => !onDocument.has(productId)
  );

  if (notOnDocument.length > 0) {
    throw badRequest(
      `One or more products are not on ${documentLabel} ${documentCode}`,
      "PRODUCT_NOT_ON_DOCUMENT",
      { ...reference, documentCode, productIds: notOnDocument }
    );
  }

  const overReturned = [...requested.entries()]
    .map(([productId, quantity]) => ({
      productId,
      available: (onDocument.get(productId) ?? 0) - (alreadyReturned.get(productId) ?? 0),
      requested: quantity,
    }))
    .filter((line) => line.requested > line.available);

  if (overReturned.length > 0) {
    throw conflict(
      `That ${documentLabel} has already had too much of one product returned`,
      "RETURN_EXCEEDS_DOCUMENT",
      { ...reference, documentCode, overReturned }
    );
  }
}

export async function createReturn(
  data: ReturnCreateInput,
  organizationId: string,
  userId: string
) {
  const { returnType, saleId, purchaseId } = data;
  const direction = movesStockIn(returnType) ? "in" : "out";
  const requested = sumByProduct(data.items);
  const productIds = [...requested.keys()];

  /**
   * The create is the only path that writes stock on the way in, and the one
   * place where a read has to stay consistent with the writes around it: the
   * already-returned total above is a sum over other rows, and a read-then-write
   * pair cannot hold that under READ COMMITTED. Two returns of one unit against
   * the same ten unit sale would both read a zero prior total, both pass, and
   * both write.
   *
   * Serializable is what makes the sum hold. A conflict between two such
   * transactions aborts one of them with P2034, which the error handler turns
   * into a 409 rather than a 500, so the caller retries and gets a real answer.
   * The stock writes themselves do not depend on this: they are single guarded
   * statements, and they are what actually protects the quantity on hand.
   */
  return prisma.$transaction(
    async (tx) => {
      // `ReturnItem.productId` is a plain foreign key with no organization
      // constraint, so the database would happily return another tenant's goods
      // and move its stock. Checked before anything is written.
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

      if (returnType === "SALE" && saleId) {
        const sale = await tx.sale.findFirst({
          where: { id: saleId, organizationId },
          select: {
            saleCode: true,
            items: { select: { productId: true, quantity: true } },
          },
        });

        if (!sale) {
          throw badRequest(
            "The sale does not exist in this organization",
            "SALE_NOT_IN_ORGANIZATION",
            { saleId }
          );
        }

        const previous = await tx.return.findMany({
          where: { saleId, organizationId },
          select: { items: { select: { productId: true, quantity: true } } },
        });

        assertQuantitiesFit({
          requested,
          documentLines: sale.items,
          alreadyReturned: sumByProduct(previous.flatMap((entry) => entry.items)),
          documentLabel: "sale",
          documentCode: sale.saleCode,
          reference: { saleId },
        });
      }

      if (returnType === "PURCHASE" && purchaseId) {
        const purchase = await tx.purchase.findFirst({
          where: { id: purchaseId, organizationId },
          select: {
            purchaseCode: true,
            purchaseItems: { select: { productId: true, quantity: true } },
          },
        });

        if (!purchase) {
          throw badRequest(
            "The purchase does not exist in this organization",
            "PURCHASE_NOT_IN_ORGANIZATION",
            { purchaseId }
          );
        }

        const previous = await tx.return.findMany({
          where: { purchaseId, organizationId },
          select: { items: { select: { productId: true, quantity: true } } },
        });

        assertQuantitiesFit({
          requested,
          documentLines: purchase.purchaseItems,
          alreadyReturned: sumByProduct(previous.flatMap((entry) => entry.items)),
          documentLabel: "purchase",
          documentCode: purchase.purchaseCode,
          reference: { purchaseId },
        });
      }

      // Read once, for the missing-row check and the shortage message. The
      // decision that actually protects stock is the guarded write below.
      const inventoryRows = await tx.inventory.findMany({
        where: { productId: { in: productIds }, organizationId },
        select: { id: true, productId: true, quantityOnHand: true },
      });
      const inventoryByProduct = new Map(
        inventoryRows.map((row) => [row.productId, row])
      );

      const missing = productIds.filter((productId) => !inventoryByProduct.has(productId));

      if (missing.length > 0) {
        throw conflict(
          "Some of the products have no stock record to move",
          "INVENTORY_ROW_MISSING",
          { productIds: missing }
        );
      }

      if (direction === "out") {
        const shortages = [...requested.entries()]
          .map(([productId, quantity]) => ({
            productId,
            available: inventoryByProduct.get(productId)!.quantityOnHand,
            requested: quantity,
          }))
          .filter((line) => line.requested > line.available);

        if (shortages.length > 0) {
          throw conflict("Not enough stock to cover this return", "INSUFFICIENT_STOCK", {
            shortages,
          });
        }
      }

      const created = await tx.return.create({
        data: {
          returnCode: data.returnCode,
          returnType,
          returnDate: data.returnDate,
          reason: data.reason,
          organizationId,
          userId,
          // Set from the type, not from the payload, so the columns cannot
          // disagree with `returnType` even if a caller slips a field past the
          // schema's superRefine.
          saleId: returnType === "SALE" ? (saleId ?? null) : null,
          purchaseId: returnType === "PURCHASE" ? (purchaseId ?? null) : null,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxAmount: item.taxAmount,
              discount: item.discount,
              note: item.note,
            })),
          },
        },
        include: detailInclude,
      });

      for (const [productId, quantity] of requested) {
        const row = inventoryByProduct.get(productId)!;

        const { previousQty, newQty } = await applyStockMovement(
          tx,
          row,
          organizationId,
          direction,
          quantity,
          {
            code: "INSUFFICIENT_STOCK",
            message: "Not enough stock to cover this return",
          }
        );

        await tx.inventoryLog.create({
          data: {
            inventoryId: row.id,
            productId,
            userId,
            movementType: movementTypeFor(returnType),
            quantity,
            previousQty,
            newQty,
            reason: data.reason
              ? `${labelFor(returnType)} ${data.returnCode}: ${data.reason}`
              : `${labelFor(returnType)} ${data.returnCode}`,
            reference: data.returnCode,
          },
        });
      }

      return created;
    },
    { isolationLevel: "Serializable" }
  );
}

/**
 * Header columns only; see `ReturnUpdateSchema` for why the type, the document
 * links and the lines are not editable.
 *
 * The legacy update ran `updateMany({ where: { id } })` with no organization
 * filter, so any member could rewrite any tenant's return, and it returned only
 * a count, leaving the caller with no record of what changed.
 */
export async function updateReturn(
  id: string,
  data: ReturnUpdateInput,
  organizationId: string
) {
  return prisma.return.update({
    where: { id, organizationId },
    data: { ...data },
    include: detailInclude,
  });
}

/**
 * Deleting a return has to put the stock back where it found it.
 *
 * Every return this service creates moves stock, so a delete that only removed
 * the row would leave a SALE return's goods on hand forever with nothing behind
 * them, and would take a PURCHASE or DAMAGED write-off's deduction out of the
 * ledger without ever recording it. The legacy `deleteReturn` had no stock
 * handling at all, because no return had any stock handling to undo.
 *
 * The reversal is written as its own ledger rows rather than by editing or
 * removing the originals: the point of the log is to show what happened to the
 * stock, and a return that was later deleted did happen. A reader sees the
 * movement out and the movement back, which is the truth.
 *
 * Reversing a SALE return is a decrease, so it is guarded like any other. If the
 * returned goods have since been sold on, the reversal is refused rather than
 * clamped at zero, which is the same refusal `createReturn` makes.
 *
 * `userId` is the member performing the delete, not `Return.userId`. The ledger
 * answers who moved the stock, and the member who took the goods back out is not
 * necessarily the member who recorded the return going in.
 */
export async function deleteReturn(id: string, organizationId: string, userId: string) {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.return.findFirst({
        where: { id, organizationId },
        include: { items: { select: { productId: true, quantity: true } } },
      });

      if (!existing) {
        throw notFound("Return not found", "RETURN_NOT_FOUND");
      }

      // The reversal is the opposite of what the return did.
      const direction = movesStockIn(existing.returnType) ? "out" : "in";

      for (const [productId, quantity] of sumByProduct(existing.items)) {
        const row = await tx.inventory.findFirst({
          where: { productId, organizationId },
          select: { id: true, quantityOnHand: true },
        });

        if (!row) {
          throw conflict("The stock record no longer exists", "INVENTORY_ROW_MISSING", {
            productId,
          });
        }

        const { previousQty, newQty } = await applyStockMovement(
          tx,
          row,
          organizationId,
          direction,
          quantity,
          {
            code: "INSUFFICIENT_STOCK_FOR_REVERSAL",
            message:
              "These goods have been sold on since this return, so it cannot be deleted " +
              "without taking stock on hand that is not there",
          }
        );

        await tx.inventoryLog.create({
          data: {
            inventoryId: row.id,
            productId,
            userId,
            // The reversal of `RETURN` is an `OUT`, and the reversal of an `OUT`,
            // `EXPIRED` or `DAMAGED` is a `RETURN`. The pair reads as one movement
            // out and one back, whichever way round the return went.
            movementType: direction === "in" ? "RETURN" : "OUT",
            quantity,
            previousQty,
            newQty,
            reason: `Reversal of return ${existing.returnCode}`,
            reference: existing.returnCode,
          },
        });
      }

      // `ReturnItem` rows cascade from the parent, so the lines go with it.
      return tx.return.delete({ where: { id, organizationId } });
    },
    { isolationLevel: "Serializable" }
  );
}
