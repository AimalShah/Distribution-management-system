import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type {
  ReturnCreateInput,
  ReturnListQuery,
  ReturnTypeValue,
  ReturnUpdateInput,
} from "@dms/shared";
import { badRequest, conflict, notFound } from "../http/errors";
import { applyStockMovement } from "./stock-movement";

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
 * A Company with no settings row still gets the documented defaults (30-day
 * window, returns on), matching `services/settings.ts`, so a policy check can
 * never silently disable returns for an organization that predates the model.
 */
const DEFAULT_RETURN_POLICY = { returnWindowDays: 30, returnsEnabled: true };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getReturns({
  organizationId,
  page,
  pageSize,
  search,
  returnType,
  deleted,
}: ReturnListQuery & { organizationId: string }) {
  const where: Prisma.ReturnWhereInput = {
    organizationId,
    // The Deleted tab asks for the soft-deleted rows explicitly; every other
    // caller sees active returns only, which is what they saw before the column
    // existed.
    deletedAt: deleted ? { not: null } : null,
  };

  if (returnType) {
    where.returnType = returnType;
  }

  if (search) {
    where.returnCode = { contains: search, mode: "insensitive" };
  }

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
  const found = await prisma.return.findFirst({
    where: { organizationId, OR: [{ id: idOrCode }, { returnCode: idOrCode }] },
    include: detailInclude,
  });

  if (!found) {
    throw notFound("Return not found", "RETURN_NOT_FOUND");
  }

  return found;
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

  const overReturned: { productId: string; available: number; requested: number }[] = [];

  for (const [productId, quantity] of requested) {
    const available = (onDocument.get(productId) ?? 0) - (alreadyReturned.get(productId) ?? 0);

    if (quantity > available) {
      overReturned.push({ productId, available, requested: quantity });
    }
  }

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
      // The Company's return policy is read inside the same transaction that
      // enforces it, so the window checked is the window in force at write time.
      if (returnType === "SALE") {
        const policy =
          (await tx.companySettings.findUnique({
            where: { organizationId },
            select: { returnWindowDays: true, returnsEnabled: true },
          })) ?? DEFAULT_RETURN_POLICY;

        if (!policy.returnsEnabled) {
          throw conflict(
            "Sale returns are disabled for this company",
            "RETURNS_DISABLED"
          );
        }

        // A sale return has to name the invoice it reverses (ADR 0008); the
        // schema already demands it, but the service holds the same line so a
        // caller that reaches it another way cannot slip past.
        if (!saleId) {
          throw badRequest(
            "A sale return must reference the original invoice",
            "SALE_REFERENCE_REQUIRED"
          );
        }
      }

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
        // A soft-deleted invoice has had its stock reversed, so nothing is left
        // for a return to hand back against it.
        const sale = await tx.sale.findFirst({
          where: { id: saleId, organizationId, deletedAt: null },
          select: {
            saleCode: true,
            saleDate: true,
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

        // The window runs from the original invoice's date, not the day the
        // return is entered, so a return cannot be kept open by sitting on it.
        const policy =
          (await tx.companySettings.findUnique({
            where: { organizationId },
            select: { returnWindowDays: true },
          })) ?? DEFAULT_RETURN_POLICY;

        const expiresAt = new Date(
          sale.saleDate.getTime() + policy.returnWindowDays * MS_PER_DAY
        );

        if (new Date() > expiresAt) {
          throw conflict(
            `This invoice is past its ${policy.returnWindowDays}-day return window`,
            "RETURN_WINDOW_EXPIRED",
            {
              saleId,
              saleCode: sale.saleCode,
              saleDate: sale.saleDate,
              returnWindowDays: policy.returnWindowDays,
              expiresAt,
            }
          );
        }

        // Deleted returns have given their headroom back, so they must not
        // still be counted against the document.
        const previous = await tx.return.findMany({
          where: { saleId, organizationId, deletedAt: null },
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
          where: { purchaseId, organizationId, deletedAt: null },
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
        const shortages: { productId: string; available: number; requested: number }[] = [];

        for (const [productId, quantity] of requested) {
          const inventory = inventoryByProduct.get(productId);

          if (inventory && quantity > inventory.quantityOnHand) {
            shortages.push({
              productId,
              available: inventory.quantityOnHand,
              requested: quantity,
            });
          }
        }

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
              condition: item.condition,
              reason: item.reason,
            })),
          },
        },
        include: detailInclude,
      });

      // The condition gate (ADR 0008): a restockable line goes back on the
      // shelf, a damaged one is credited and recorded but never put back on
      // hand. Only SALE returns pass through the gate; a purchase return or a
      // write-off moves every line the same way regardless of condition.
      const restockable =
        returnType === "SALE"
          ? sumByProduct(data.items.filter((item) => item.condition === "RESTOCKABLE"))
          : requested;

      for (const [productId, quantity] of restockable) {
        // The stock row and the ledger row move together inside the module;
        // what stays here is the document's own words for a refusal.
        await applyStockMovement({
          tx,
          organizationId,
          userId,
          productId,
          direction,
          quantity,
          movementType: movementTypeFor(returnType),
          reason: data.reason
            ? `${labelFor(returnType)} ${data.returnCode}: ${data.reason}`
            : `${labelFor(returnType)} ${data.returnCode}`,
          reference: data.returnCode,
          // Consulted only when the direction takes stock out: an inbound
          // handback never reaches the guard.
          refusal: (available) =>
            conflict("Not enough stock to cover this return", "INSUFFICIENT_STOCK", {
              available,
              requested: quantity,
            }),
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
 * Deleting a return has to put the stock back where it found it — and the row
 * itself has to survive.
 *
 * Every return this service creates moves stock, so a delete that only stamped
 * the row would leave a SALE return's goods on hand forever with nothing behind
 * them, and would take a PURCHASE or DAMAGED write-off's deduction out of the
 * ledger without ever recording it. The reversal therefore runs exactly as it
 * always did: its own ledger rows (never edits to the originals), guarded so a
 * return whose goods have been sold on since is refused rather than clamped.
 *
 * What changed at checkpoint 14 is the second half: the row is soft-deleted
 * (`deletedAt` stamped) instead of removed, so the audit trail survives and the
 * return can be restored. Physical deletion exists only in test fixtures.
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

      if (existing.deletedAt) {
        throw conflict("This return has already been deleted", "RETURN_ALREADY_DELETED", {
          id: existing.id,
          returnCode: existing.returnCode,
        });
      }

      // The reversal is the opposite of what the return did.
      const direction = movesStockIn(existing.returnType) ? "out" : "in";

      for (const [productId, quantity] of sumByProduct(existing.items)) {
        await applyStockMovement({
          tx,
          organizationId,
          userId,
          productId,
          direction,
          quantity,
          // The reversal of `RETURN` is an `OUT`, and the reversal of an `OUT`,
          // `EXPIRED` or `DAMAGED` is a `RETURN`. The pair reads as one movement
          // out and one back, whichever way round the return went.
          movementType: direction === "in" ? "RETURN" : "OUT",
          reason: `Reversal of return ${existing.returnCode}`,
          reference: existing.returnCode,
          // Consulted only when the direction takes stock out: giving stock
          // back to the warehouse never reaches the guard.
          refusal: (available) =>
            conflict(
              "These goods have been sold on since this return, so it cannot be deleted " +
                "without taking stock on hand that is not there",
              "INSUFFICIENT_STOCK_FOR_REVERSAL",
              { available, requested: quantity }
            ),
        });
      }

      // The lines stay: they are the record of what was returned, and the
      // Deleted tab shows the same detail view as the active list.
      return tx.return.update({
        where: { id, organizationId },
        data: { deletedAt: new Date() },
        include: detailInclude,
      });
    },
    { isolationLevel: "Serializable" }
  );
}

/**
 * Undo a soft delete: re-apply the movement the delete reversed, then clear
 * `deletedAt`.
 *
 * The asymmetry with `deleteReturn` is deliberate. Restoring a SALE return moves
 * stock *in*, which needs no guard. Restoring a PURCHASE return or a write-off
 * moves stock *out* — the deduction the delete gave back — and is refused with
 * `INSUFFICIENT_STOCK_FOR_RESTORE` if the goods are no longer there, because
 * clamping at zero would put a movement in the ledger that never happened.
 *
 * The document headroom is re-checked too, at `Serializable` for the same reason
 * `createReturn` is: while the return was deleted, another return could have
 * taken the quantity this one is about to claim back, and a sum over other rows
 * cannot hold under READ COMMITTED.
 */
export async function restoreReturn(id: string, organizationId: string, userId: string) {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.return.findFirst({
        where: { id, organizationId },
        include: { items: { select: { productId: true, quantity: true } } },
      });

      if (!existing) {
        throw notFound("Return not found", "RETURN_NOT_FOUND");
      }

      if (!existing.deletedAt) {
        throw conflict("This return is not deleted", "RETURN_NOT_DELETED", {
          id: existing.id,
          returnCode: existing.returnCode,
        });
      }

      const requested = sumByProduct(existing.items);

      // The deleted return is excluded from its own headroom: it is claiming
      // back exactly the quantity it held before, and counting itself would
      // refuse every restore of a return against a document it filled.
      if (existing.returnType === "SALE" && existing.saleId) {
        const sale = await tx.sale.findFirst({
          where: { id: existing.saleId, organizationId, deletedAt: null },
          select: {
            saleCode: true,
            items: { select: { productId: true, quantity: true } },
          },
        });

        if (!sale) {
          throw conflict(
            "The invoice this return reverses has been deleted, so the return " +
              "cannot be brought back",
            "SALE_DELETED",
            { saleId: existing.saleId }
          );
        }

        const previous = await tx.return.findMany({
          where: { saleId: existing.saleId, organizationId, deletedAt: null },
          select: { items: { select: { productId: true, quantity: true } } },
        });

        assertQuantitiesFit({
          requested,
          documentLines: sale.items,
          alreadyReturned: sumByProduct(previous.flatMap((entry) => entry.items)),
          documentLabel: "sale",
          documentCode: sale.saleCode,
          reference: { saleId: existing.saleId },
        });
      }

      if (existing.returnType === "PURCHASE" && existing.purchaseId) {
        const purchase = await tx.purchase.findFirst({
          where: { id: existing.purchaseId, organizationId },
          select: {
            purchaseCode: true,
            purchaseItems: { select: { productId: true, quantity: true } },
          },
        });

        if (!purchase) {
          throw conflict(
            "The purchase this return reverses no longer exists, so the return " +
              "cannot be brought back",
            "PURCHASE_NOT_FOUND",
            { purchaseId: existing.purchaseId }
          );
        }

        const previous = await tx.return.findMany({
          where: { purchaseId: existing.purchaseId, organizationId, deletedAt: null },
          select: { items: { select: { productId: true, quantity: true } } },
        });

        assertQuantitiesFit({
          requested,
          documentLines: purchase.purchaseItems,
          alreadyReturned: sumByProduct(previous.flatMap((entry) => entry.items)),
          documentLabel: "purchase",
          documentCode: purchase.purchaseCode,
          reference: { purchaseId: existing.purchaseId },
        });
      }

      // Restore re-applies what the return originally did, so the direction is
      // the return's own — not the delete's reversal.
      const direction = movesStockIn(existing.returnType) ? "in" : "out";

      for (const [productId, quantity] of requested) {
        await applyStockMovement({
          tx,
          organizationId,
          userId,
          productId,
          direction,
          quantity,
          movementType: movementTypeFor(existing.returnType),
          reason: `Restoration of return ${existing.returnCode}`,
          reference: existing.returnCode,
          // Consulted only when the direction takes stock out: re-applying a
          // customer handback never reaches the guard.
          refusal: (available) =>
            conflict(
              "There is no longer enough stock on hand to re-apply this return, so it " +
                "cannot be restored",
              "INSUFFICIENT_STOCK_FOR_RESTORE",
              { available, requested: quantity }
            ),
        });
      }

      return tx.return.update({
        where: { id, organizationId },
        data: { deletedAt: null },
        include: detailInclude,
      });
    },
    { isolationLevel: "Serializable" }
  );
}
