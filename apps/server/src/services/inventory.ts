import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type {
  InventoryAdjustInput,
  InventoryBulkImportRow,
  InventoryCreateInput,
  InventoryMovementValue,
  InventorySettingsInput,
} from "@dms/shared";
import { badRequest, conflict, notFound } from "../http/errors";

/**
 * The legacy `getInventory` embedded `logs: true`, so every adjustment ever made
 * to a product shipped with the list. On a paginated list that is unbounded, so
 * the response carries the count and the rows themselves stay on `/logs`.
 */
const inventoryInclude = {
  product: true,
  _count: { select: { logs: true } },
} satisfies Prisma.InventoryInclude;

// The legacy log query included the full user row; email and name is what the
// log tables actually render.
const logInclude = {
  product: true,
  user: { select: { name: true, email: true } },
  inventory: true,
} satisfies Prisma.InventoryLogInclude;

const INCREASES: InventoryMovementValue[] = ["IN", "RETURN"];
const DECREASES: InventoryMovementValue[] = ["OUT", "DAMAGED", "EXPIRED"];

/**
 * How a movement type changes the quantity on hand.
 *
 * - `in` / `out`: `quantity` is a magnitude and the type supplies the direction.
 * - `count`: `quantity` is the figure a physical count found, so it replaces the
 *   row outright rather than moving by a margin.
 */
type MovementKind = "in" | "out" | "count";

/**
 * The movement table in one place, resolved before anything is written so an
 * unsupported type is refused rather than discovered halfway through.
 *
 * The legacy `adjustInventoryQuantity` had two defects it hid behind
 * `Math.max(0, newQty)`:
 *
 * - `ADJUSTMENT` and `TRANSFER` set the absolute figure (`newQty = quantity`)
 *   but still logged `quantity` as if it were the amount moved, so the log read
 *   "moved 20" for a change of 15 and no longer added up.
 * - `DAMAGED` and `EXPIRED` clamped the result at zero, so writing off 10 of 5
 *   recorded a movement of 10 against a change of 5 and lost the shortfall.
 */
const classifyMovement = (movementType: InventoryMovementValue): MovementKind => {
  if (INCREASES.includes(movementType)) return "in";
  if (DECREASES.includes(movementType)) return "out";
  if (movementType === "ADJUSTMENT") return "count";

  // TRANSFER: there is one `Inventory` row per product and no destination or
  // location column, so a transfer has nowhere to go. The legacy service
  // treated it as an absolute set, which silently rewrote the quantity.
  throw badRequest(
    "Stock transfers need a destination location, which this schema does not model yet",
    "UNSUPPORTED_MOVEMENT",
    { movementType }
  );
};

/**
 * The figure a log row records.
 *
 * A log's `quantity` is a **magnitude** for `IN`, `OUT`, `RETURN`, `DAMAGED` and
 * `EXPIRED` — the direction lives in `movementType`, so an `OUT` of 4 records
 * `quantity: 4, previousQty: 10, newQty: 6` and an `IN` of 4 records the same
 * `quantity: 4`. It is **signed** only for `ADJUSTMENT`, where it is the
 * difference a physical count found: `previousQty + quantity = newQty`.
 *
 * So a directional row satisfies `|previousQty - newQty| = quantity`, and only
 * the count row satisfies `previousQty + quantity = newQty`. Getting this
 * distinction wrong is not hypothetical: checkpoint 2m's report work found the
 * legacy basic inventory report summing this column and reporting the total as
 * a quantity, which counts a delivery and a dispatch of the same size as twice
 * the stock.
 */
const loggedQuantityFor = (kind: MovementKind, previousQty: number, quantity: number) =>
  kind === "count" ? quantity - previousQty : quantity;

type MovementTarget = {
  id: string;
  productId: string;
  organizationId: string;
  quantityOnHand: number;
};

export async function getInventory({
  organizationId,
  page,
  pageSize,
}: {
  organizationId: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.InventoryWhereInput = { organizationId };

  const [data, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      include: inventoryInclude,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventory.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

export async function getInventoryById(id: string, organizationId: string) {
  return prisma.inventory.findFirst({
    where: { id, organizationId },
    include: inventoryInclude,
  });
}

export async function getInventoryLogs({
  organizationId,
  page,
  pageSize,
  productId,
}: {
  organizationId: string;
  page: number;
  pageSize: number;
  productId?: string;
}) {
  // `InventoryLog` has no `organizationId` column, so the tenant is reached
  // through the product relation. The checkpoint plan's `where:
  // { organizationId }` on the log model would be rejected by Prisma.
  const where: Prisma.InventoryLogWhereInput = {
    product: { organizationId },
    ...(productId ? { productId } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.inventoryLog.findMany({
      where,
      include: logInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryLog.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

export async function getLowStock({
  organizationId,
  page,
  pageSize,
}: {
  organizationId: string;
  page: number;
  pageSize: number;
}) {
  // Column to column comparison. The legacy query used
  // `prisma.inventory.fields?.reorderLevel || 0`, and a plain `where` cannot
  // express `quantityOnHand <= reorderLevel`; the field reference is the
  // supported way to do it and the optional chain was hiding a working feature
  // rather than papering over a missing one.
  const where: Prisma.InventoryWhereInput = {
    organizationId,
    quantityOnHand: { lte: prisma.inventory.fields.reorderLevel },
  };

  const [data, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      include: { product: true },
      orderBy: { quantityOnHand: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventory.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

/**
 * Creating an inventory row with stock on hand writes no opening log entry; the
 * legacy `addInventory` did not either. The audit trail therefore starts at the
 * first adjustment. It is kept as-is for parity rather than silently inventing
 * a movement the legacy data does not have.
 */
export async function createInventory(
  data: InventoryCreateInput,
  organizationId: string
) {
  // `Inventory.productId` is unique across organizations, so a create naming a
  // product id this organization does not own would attach a stock row to
  // another tenant's product. The tenant check turns that into a 400.
  const product = await prisma.product.findFirst({
    where: { id: data.productId, organizationId },
    select: { id: true },
  });

  if (!product) {
    throw badRequest(
      "The product does not exist in this organization",
      "PRODUCT_NOT_IN_ORGANIZATION",
      { productId: data.productId }
    );
  }

  return prisma.inventory.create({
    data: {
      productId: data.productId,
      organizationId,
      quantityOnHand: data.quantityOnHand,
      // `??` rather than `||` so an explicit 0 is kept instead of falling back
      // to the default.
      quantityReserved: data.quantityReserved ?? 0,
      reorderLevel: data.reorderLevel ?? 0,
      maxStockLevel: data.maxStockLevel ?? null,
    },
    include: inventoryInclude,
  });
}

export async function adjustInventory(
  data: InventoryAdjustInput,
  organizationId: string,
  userId: string
) {
  const { movementType, quantity } = data;

  // Resolved before the transaction opens, so an unsupported movement is
  // refused without a row being read or written.
  const kind = classifyMovement(movementType);

  // A movement that moves nothing is not a movement. A count is exempt because
  // a count of zero is a real count.
  if (kind !== "count" && quantity < 1) {
    throw badRequest(
      "Quantity must be at least 1 for this movement",
      "QUANTITY_MUST_BE_POSITIVE",
      { movementType }
    );
  }

  return prisma.$transaction(async (tx) => {
    /**
     * Moves the stock and hands back the pair the ledger needs.
     *
     * The quantity is never computed from a read and written back. That pattern
     * cannot hold under READ COMMITTED: with 10 on hand, a concurrent `IN 5` and
     * `OUT 5` both read 10, then both write their own answer, so 20 units pass
     * through the row and the two log entries describe movements that never
     * happened against each other. Each direction below is instead a single
     * statement the database evaluates against the row it is updating, so the
     * quantity on hand and the log entry describing it can never disagree.
     */
    const applyMovement = async (
      target: MovementTarget,
      moveQuantity: number
    ): Promise<{ previousQty: number; newQty: number }> => {
      const scope = { id: target.id, organizationId: target.organizationId } as const;

      if (kind === "in") {
        const updated = await tx.inventory.update({
          where: scope,
          data: { quantityOnHand: { increment: moveQuantity } },
          select: { quantityOnHand: true },
        });
        return {
          previousQty: updated.quantityOnHand - moveQuantity,
          newQty: updated.quantityOnHand,
        };
      }

      if (kind === "out") {
        // The `gte` guard and the decrement are the same statement, so only one
        // transaction can claim the units. `count === 0` means this caller did
        // not get them, and the follow-up read is what tells a genuine shortage
        // apart from a row a concurrent transaction deleted.
        const claimed = await tx.inventory.updateMany({
          where: { ...scope, quantityOnHand: { gte: moveQuantity } },
          data: { quantityOnHand: { decrement: moveQuantity } },
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

          // Refuse rather than clamp. The legacy service wrote
          // `Math.max(0, newQty)`, so writing off 10 against 5 in stock recorded
          // a movement of 10 for a change of 5 and the shortfall simply
          // disappeared.
          throw conflict("Not enough stock for this movement", "INSUFFICIENT_STOCK", {
            available: current.quantityOnHand,
            requested: moveQuantity,
          });
        }

        // `updateMany` returns a count rather than a row, so the opening figure
        // is read back off the row as it stands after the write. That keeps
        // `previousQty - quantity = newQty` true by construction even when
        // another transaction committed between the scope read and this write.
        const current = await tx.inventory.findFirstOrThrow({
          where: scope,
          select: { quantityOnHand: true },
        });

        return {
          previousQty: current.quantityOnHand + moveQuantity,
          newQty: current.quantityOnHand,
        };
      }

      // A count is a physical figure, so the caller's number is the answer
      // whatever the row said a moment ago. The opening figure is still read,
      // because it is what the log records as the change the count made. Two
      // operators counting the same shelf at the same moment is a conflict in
      // the warehouse rather than an invariant in the database, so the last
      // count wins; the alternative is a lock this endpoint does not otherwise
      // need.
      const updated = await tx.inventory.update({
        where: scope,
        data: { quantityOnHand: moveQuantity },
        select: { quantityOnHand: true },
      });

      return { previousQty: target.quantityOnHand, newQty: updated.quantityOnHand };
    };

    // Scoped to the organization. The legacy `findUnique({ where: { productId } })`
    // had no tenant filter, so a caller could adjust another tenant's stock by
    // naming a product id they do not own.
    const target = await tx.inventory.findFirst({
      where: { id: data.inventoryId, organizationId },
      select: { id: true, productId: true, organizationId: true, quantityOnHand: true },
    });

    if (!target) {
      throw notFound("Inventory record not found", "INVENTORY_NOT_FOUND");
    }

    const { previousQty, newQty } = await applyMovement(target, quantity);

    await tx.inventoryLog.create({
      data: {
        inventoryId: target.id,
        productId: target.productId,
        userId,
        movementType,
        quantity: loggedQuantityFor(kind, previousQty, quantity),
        previousQty,
        newQty,
        reason: data.reason,
      },
    });

    return tx.inventory.findFirstOrThrow({
      where: { id: target.id, organizationId },
      include: inventoryInclude,
    });
  });
}

export async function updateInventorySettings(
  id: string,
  data: InventorySettingsInput,
  organizationId: string
) {
  // `where: { id, organizationId }` makes a foreign id a P2025, which the error
  // handler maps to a 404. The legacy lookup keyed on `productId` with no tenant
  // filter, so any member could rewrite any tenant's reorder levels.
  return prisma.inventory.update({
    where: { id, organizationId },
    data: { ...data },
    include: inventoryInclude,
  });
}

export interface BulkImportError {
  row: number;
  productCode?: string;
  error: string;
}

export interface BulkImportResult {
  success: number;
  created: number;
  updated: number;
  errors: BulkImportError[];
}

export async function bulkImportInventory(
  rows: InventoryBulkImportRow[],
  organizationId: string
): Promise<BulkImportResult> {
  const errors: BulkImportError[] = [];
  const validCandidates: { rowNum: number; data: InventoryBulkImportRow }[] = [];

  // 1. Initial field validation per row
  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    if (!row.productCode || typeof row.productCode !== "string" || !row.productCode.trim()) {
      errors.push({ row: rowNum, error: "Missing or invalid productCode" });
      return;
    }
    const qty = Number(row.quantityOnHand);
    if (isNaN(qty) || !Number.isInteger(qty) || qty < 0) {
      errors.push({
        row: rowNum,
        productCode: row.productCode,
        error: "quantityOnHand must be a non-negative integer",
      });
      return;
    }
    if (
      row.reorderLevel !== undefined &&
      (isNaN(Number(row.reorderLevel)) || !Number.isInteger(Number(row.reorderLevel)) || Number(row.reorderLevel) < 0)
    ) {
      errors.push({
        row: rowNum,
        productCode: row.productCode,
        error: "reorderLevel must be a non-negative integer",
      });
      return;
    }
    if (
      row.maxStockLevel !== undefined &&
      (isNaN(Number(row.maxStockLevel)) || !Number.isInteger(Number(row.maxStockLevel)) || Number(row.maxStockLevel) < 0)
    ) {
      errors.push({
        row: rowNum,
        productCode: row.productCode,
        error: "maxStockLevel must be a non-negative integer",
      });
      return;
    }

    validCandidates.push({
      rowNum,
      data: {
        ...row,
        productCode: row.productCode.trim(),
        quantityOnHand: qty,
        reorderLevel: row.reorderLevel !== undefined ? Number(row.reorderLevel) : undefined,
        maxStockLevel: row.maxStockLevel !== undefined ? Number(row.maxStockLevel) : undefined,
      },
    });
  });

  if (validCandidates.length === 0) {
    return { success: 0, created: 0, updated: 0, errors };
  }

  // 2. Resolve products in organization
  const productCodes = Array.from(new Set(validCandidates.map((c) => c.data.productCode)));
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      productCode: { in: productCodes },
    },
    select: { id: true, productCode: true, name: true },
  });

  const productMap = new Map<string, { id: string; productCode: string; name: string }>();
  for (const p of products) {
    productMap.set(p.productCode, p);
  }

  const toImport: {
    rowNum: number;
    product: { id: string; productCode: string; name: string };
    data: InventoryBulkImportRow;
  }[] = [];

  for (const item of validCandidates) {
    const p = productMap.get(item.data.productCode);
    if (!p) {
      errors.push({
        row: item.rowNum,
        productCode: item.data.productCode,
        error: `Product with code '${item.data.productCode}' not found in organization`,
      });
    } else {
      toImport.push({ rowNum: item.rowNum, product: p, data: item.data });
    }
  }

  if (toImport.length === 0) {
    return { success: 0, created: 0, updated: 0, errors };
  }

  // 3. Atomically upsert inventory records in a transaction
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of toImport) {
      const existing = await tx.inventory.findFirst({
        where: { productId: item.product.id, organizationId },
      });

      if (existing) {
        await tx.inventory.update({
          where: { id: existing.id },
          data: {
            quantityOnHand: item.data.quantityOnHand,
            ...(item.data.reorderLevel !== undefined ? { reorderLevel: item.data.reorderLevel } : {}),
            ...(item.data.maxStockLevel !== undefined ? { maxStockLevel: item.data.maxStockLevel } : {}),
          },
        });
        updated++;
      } else {
        await tx.inventory.create({
          data: {
            productId: item.product.id,
            organizationId,
            quantityOnHand: item.data.quantityOnHand,
            reorderLevel: item.data.reorderLevel ?? 0,
            maxStockLevel: item.data.maxStockLevel ?? null,
            quantityReserved: 0,
          },
        });
        created++;
      }
    }
  });

  return {
    success: toImport.length,
    created,
    updated,
    errors,
  };
}

