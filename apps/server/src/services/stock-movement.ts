import type prisma from "@dms/db";
import type { InventoryMovementValue } from "@dms/shared";
import { conflict } from "../http/errors";

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
 * How the caller wants the quantity read. `in` and `out` treat `quantity` as a
 * magnitude the direction already explains; `count` treats it as the absolute
 * figure a physical count found, which is what makes a count of zero legal
 * where a movement of zero is not.
 */
export type StockDirection = "in" | "out" | "count";

/**
 * Goods arriving from outside the warehouse, named by the lot they belong to.
 * The receipt is the only inbound arrival that gives the batch records new
 * expiry and cost information; everything else has to be inferred from what is
 * already on the row.
 */
export interface StockReceipt {
  batchNumber: string;
  expiryDate?: Date | null;
  unitCost: number;
  purchaseItemId?: string;
}

/**
 * What a caller asks of the stock-movement module. The caller supplies the
 * policy (which document, which words to refuse with, which movement type the
 * ledger records); the module supplies the guarded write, the ledger row and the
 * batch consequences, because those are one indivisible movement.
 */
export interface StockMovementRequest {
  tx: TransactionTx;
  organizationId: string;
  userId: string;
  productId: string;
  direction: StockDirection;
  quantity: number;
  /**
   * The `InventoryMovement` the ledger row records. Direction and type can
   * disagree on purpose: deleting a SALE return moves stock out but records an
   * `OUT`, and deleting a write-off moves stock in but records a `RETURN`, so a
   * reversal pair reads as one movement out and one back.
   */
  movementType: InventoryMovementValue;
  reason: string;
  reference?: string;
  /**
   * Required in spirit for `out`: the refusal the module throws when the guarded
   * decrement claims nothing, built in the caller's words because only the
   * caller knows what its document should say about a shortage. The module
   * supplies its own generic refusal if a caller has none.
   */
  refusal?: (available: number) => Error;
  /**
   * Inbound only. Goods that arrive against a purchase receipt state the lot
   * they belong to (`receipt`); goods with no batch identity of their own ask to
   * stay out of the batch records (`untracked`). Anything else — goods coming
   * back out of the warehouse — credits the batches that are short, which is the
   * default when the field is absent.
   */
  batch?: { receipt: StockReceipt } | { untracked: true };
  /**
   * Inbound only. The first receipt of a product may open the stock row, seeded
   * with this reorder level; without it a missing row is a refusal, because
   * moving stock for a row that was never created would resurrect a record a
   * reversal path expects to be gone.
   */
  opening?: { reorderLevel: number };
}

export interface StockMovementResult {
  inventoryId: string;
  previousQty: number;
  newQty: number;
  /** The first batch an `out` movement drew from, so a sale line can name its lot. */
  batchId: string | null;
}

/**
 * Move one product's stock, record the movement in the ledger, and carry the
 * batch consequences through — all of it as one statement chain inside the
 * caller's transaction.
 *
 * The quantity is never computed from a read and written back. That pattern
 * cannot hold under READ COMMITTED: with 10 on hand, a concurrent inbound and
 * outbound movement of the same product would both read 10, then both write
 * their own answer, so 20 units pass through the row and the two log entries
 * describe movements that never happened against each other. Each direction is
 * instead a single statement the database evaluates against the row it is
 * updating, so the quantity on hand and the log entry describing it can never
 * disagree. An increase is plain arithmetic; a decrease is a guarded decrement
 * whose `gte` guard and decrement are the same statement, so only one
 * transaction can claim the units.
 *
 * The row is resolved here rather than passed in, so every caller gets the same
 * missing-row refusal and the same tenant scope — the caller's remaining policy
 * guards are the ones only the caller can own: a document-level shortage
 * message, a 404 for an unknown id, an aggregate pre-check.
 */
export async function applyStockMovement(
  request: StockMovementRequest
): Promise<StockMovementResult> {
  const { tx, organizationId, userId, productId, direction, quantity, movementType, reason, reference } = request;

  // The first receipt of a product arrives before any row exists, so the
  // open-or-increment is one atomic upsert rather than a read that decides
  // between two writes: `Inventory.productId` is unique across organizations,
  // and the caller has already established that this tenant owns the product.
  if (direction === "in" && request.opening) {
    const opened = await tx.inventory.upsert({
      where: { productId },
      update: { quantityOnHand: { increment: quantity } },
      create: {
        productId,
        organizationId,
        quantityOnHand: quantity,
        reorderLevel: request.opening.reorderLevel,
      },
    });

    const newQty = opened.quantityOnHand;
    const previousQty = newQty - quantity;

    await tx.inventoryLog.create({
      data: {
        inventoryId: opened.id,
        productId,
        userId,
        movementType,
        quantity,
        previousQty,
        newQty,
        reason,
        reference,
      },
    });

    const batchId = await applyBatchConsequence(request, previousQty, newQty);

    return { inventoryId: opened.id, previousQty, newQty, batchId };
  }

  const row = await tx.inventory.findFirst({
    where: { productId, organizationId },
    select: { id: true, quantityOnHand: true },
  });

  if (!row) {
    throw conflict("The stock record no longer exists", "INVENTORY_ROW_MISSING", {
      productId,
    });
  }

  const scope = { id: row.id, organizationId } as const;

  if (direction === "in") {
    const updated = await tx.inventory.update({
      where: scope,
      data: { quantityOnHand: { increment: quantity } },
      select: { quantityOnHand: true },
    });

    const newQty = updated.quantityOnHand;
    const previousQty = newQty - quantity;

    await tx.inventoryLog.create({
      data: {
        inventoryId: row.id,
        productId,
        userId,
        movementType,
        quantity,
        previousQty,
        newQty,
        reason,
        reference,
      },
    });

    const batchId = await applyBatchConsequence(request, previousQty, newQty);

    return { inventoryId: row.id, previousQty, newQty, batchId };
  }

  if (direction === "out") {
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
          productId,
        });
      }

      // Refuse rather than clamp. Clamping at zero records a movement of 10
      // against a change of 5 and the shortfall simply disappears.
      throw (
        request.refusal?.(current.quantityOnHand) ??
        conflict("Not enough stock for this movement", "INSUFFICIENT_STOCK", {
          available: current.quantityOnHand,
          requested: quantity,
        })
      );
    }

    // `updateMany` returns a count rather than a row, so the opening figure is
    // read back off the row as it stands after the write. That keeps the
    // ledger's arithmetic true by construction even when another transaction
    // committed between the scope read and this write.
    const current = await tx.inventory.findFirstOrThrow({
      where: scope,
      select: { quantityOnHand: true },
    });

    const newQty = current.quantityOnHand;
    const previousQty = newQty + quantity;

    await tx.inventoryLog.create({
      data: {
        inventoryId: row.id,
        productId,
        userId,
        movementType,
        quantity,
        previousQty,
        newQty,
        reason,
        reference,
      },
    });

    const batchId = await applyBatchConsequence(request, previousQty, newQty);

    return { inventoryId: row.id, previousQty, newQty, batchId };
  }

  // A count is a physical figure, so the caller's number is the answer whatever
  // the row said a moment ago. Two operators counting the same shelf at the same
  // moment is a conflict in the warehouse rather than an invariant in the
  // database, so the last count wins; the alternative is a lock this movement
  // does not otherwise need.
  const counted = await tx.inventory.update({
    where: scope,
    data: { quantityOnHand: quantity },
    select: { quantityOnHand: true },
  });

  const previousQty = row.quantityOnHand;
  const newQty = counted.quantityOnHand;

  // The ledger's `quantity` is a magnitude for directional movements but a
  // signed difference for a count: previousQty + quantity = newQty is what the
  // log row must satisfy, while an `OUT` of 4 records quantity 4 with
  // previousQty - quantity = newQty. Getting this wrong is not hypothetical:
  // the legacy report summed this column and counted a delivery and a
  // dispatch of the same size as twice the stock.
  await tx.inventoryLog.create({
    data: {
      inventoryId: row.id,
      productId,
      userId,
      movementType,
      quantity: newQty - previousQty,
      previousQty,
      newQty,
      reason,
      reference,
    },
  });

  const batchId = await applyBatchConsequence(request, previousQty, newQty);

  return { inventoryId: row.id, previousQty, newQty, batchId };
}

/**
 * Carry the movement into the batch records, and hand back the lot an outbound
 * movement drew from.
 *
 * The aggregate inventory row is authoritative: a shortage against the batch
 * records never refuses a movement that already succeeded against it, because
 * plenty of stock is untracked (no batch number on the receipt, goods moved
 * before batches existed) and the deduction simply has nothing to touch.
 */
async function applyBatchConsequence(
  request: StockMovementRequest,
  previousQty: number,
  newQty: number
): Promise<string | null> {
  const { tx, organizationId, productId, quantity, direction, batch } = request;

  if (direction === "out") {
    return deductFirstExpiredFirstOut(tx, productId, organizationId, quantity);
  }

  if (direction === "count") {
    const delta = newQty - previousQty;

    if (delta > 0) {
      await creditShortBatches(tx, productId, organizationId, delta);
    } else if (delta < 0) {
      await deductFirstExpiredFirstOut(tx, productId, organizationId, -delta);
    }

    return null;
  }

  if (batch && "receipt" in batch) {
    await tx.stockBatch.upsert({
      where: {
        productId_batchNumber_organizationId: {
          productId,
          batchNumber: batch.receipt.batchNumber,
          organizationId,
        },
      },
      update: {
        quantityRemaining: { increment: quantity },
        quantityReceived: { increment: quantity },
        unitCost: batch.receipt.unitCost,
        expiryDate: batch.receipt.expiryDate
          ? new Date(batch.receipt.expiryDate)
          : undefined,
      },
      create: {
        productId,
        organizationId,
        batchNumber: batch.receipt.batchNumber,
        expiryDate: batch.receipt.expiryDate ? new Date(batch.receipt.expiryDate) : null,
        quantityReceived: quantity,
        quantityRemaining: quantity,
        unitCost: batch.receipt.unitCost,
        purchaseItemId: batch.receipt.purchaseItemId,
      },
    });

    return null;
  }

  if (batch && "untracked" in batch) {
    return null;
  }

  await creditShortBatches(tx, productId, organizationId, quantity);

  return null;
}

/**
 * Deduct the lots nearest their expiry first, and name the first one touched so
 * a sale line can record which lot its units came from.
 *
 * A batch with no expiry sorts last (the database puts nulls at the end of an
 * ascending order), so dated stock always leaves before undated stock of the
 * same product. What the deduction cannot cover is not an error: untracked
 * goods have no batch to deduct from, and the row above already moved.
 */
async function deductFirstExpiredFirstOut(
  tx: TransactionTx,
  productId: string,
  organizationId: string,
  quantity: number
): Promise<string | null> {
  const batches = await tx.stockBatch.findMany({
    where: { productId, organizationId, quantityRemaining: { gt: 0 } },
    orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
  });

  let remaining = quantity;
  let firstBatchId: string | null = null;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const deduct = Math.min(batch.quantityRemaining, remaining);
    await tx.stockBatch.update({
      where: { id: batch.id },
      data: { quantityRemaining: { decrement: deduct } },
    });
    firstBatchId ??= batch.id;
    remaining -= deduct;
  }

  return firstBatchId;
}

/**
 * Give units back to the lots that are short of what they received, latest
 * expiry last — the reverse of the order they were deducted in, so a reversal
 * fills the holes the deduction opened rather than a lot that never emptied.
 *
 * Crediting is capped by each lot's own deficit, so the batch records never
 * claim more stock than the purchase receipt put in.
 */
async function creditShortBatches(
  tx: TransactionTx,
  productId: string,
  organizationId: string,
  quantity: number
): Promise<void> {
  const batches = await tx.stockBatch.findMany({
    where: { productId, organizationId },
    orderBy: [{ expiryDate: "desc" }, { receivedAt: "desc" }],
  });

  let remaining = quantity;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const short = batch.quantityReceived - batch.quantityRemaining;

    if (short <= 0) continue;

    const credit = Math.min(short, remaining);
    await tx.stockBatch.update({
      where: { id: batch.id },
      data: { quantityRemaining: { increment: credit } },
    });
    remaining -= credit;
  }
}
