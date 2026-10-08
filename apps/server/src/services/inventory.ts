import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import {
  inventoryBulkImportRowSchema,
  type InventoryAdjustInput,
  type InventoryBulkImportRow,
  type InventoryCreateInput,
  type InventoryMovementValue,
  type InventorySettingsInput,
} from "@dms/shared";
import { badRequest, conflict, notFound } from "../http/errors";
import { applyStockMovement } from "./stock-movement";

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
  const inventory = await prisma.inventory.findFirst({
    where: { id, organizationId },
    include: inventoryInclude,
  });

  if (!inventory) {
    throw notFound("Inventory record not found", "INVENTORY_NOT_FOUND");
  }

  return inventory;
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
  };

  if (productId) {
    where.productId = productId;
  }

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
    // Scoped to the organization. The legacy `findUnique({ where: { productId } })`
    // had no tenant filter, so a caller could adjust another tenant's stock by
    // naming a product id they do not own.
    const target = await tx.inventory.findFirst({
      where: { id: data.inventoryId, organizationId },
      select: { id: true, productId: true },
    });

    if (!target) {
      throw notFound("Inventory record not found", "INVENTORY_NOT_FOUND");
    }

    // This caller's policy stops at the lookup: the movement type is one this
    // model supports, the quantity is legal, the id resolves in this
    // organization. The guarded write, the ledger row and the batch
    // consequences are one movement, so the module keeps them together.
    await applyStockMovement({
      tx,
      organizationId,
      userId,
      productId: target.productId,
      direction: kind,
      quantity,
      movementType,
      reason: data.reason,
      // Consulted only for the decreasing direction: an increase or a count
      // never reaches the guard.
      refusal: (available) =>
        conflict("Not enough stock for this movement", "INSUFFICIENT_STOCK", {
          available,
          requested: quantity,
        }),
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

  // 1. Initial field validation per row. `productCode` is decoded by the shared
  // row schema instead of being narrowed with a runtime check: the rows arrive
  // from the route's payload parsing, and the schema is the owner of what
  // counts as a code.
  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const parsedCode = inventoryBulkImportRowSchema.shape.productCode.safeParse(
      row.productCode
    );

    if (!parsedCode.success) {
      errors.push({ row: rowNum, error: "Missing or invalid productCode" });

      return;
    }

    const qty = Number(row.quantityOnHand);

    if (isNaN(qty) || !Number.isInteger(qty) || qty < 0) {
      errors.push({
        row: rowNum,
        productCode: parsedCode.data,
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
        productCode: parsedCode.data,
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
        productCode: parsedCode.data,
        error: "maxStockLevel must be a non-negative integer",
      });

      return;
    }

    validCandidates.push({
      rowNum,
      data: {
        ...row,
        productCode: parsedCode.data,
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
        const updateData: Prisma.InventoryUpdateInput = {
          quantityOnHand: item.data.quantityOnHand,
        };

        if (item.data.reorderLevel !== undefined) {
          updateData.reorderLevel = item.data.reorderLevel;
        }

        if (item.data.maxStockLevel !== undefined) {
          updateData.maxStockLevel = item.data.maxStockLevel;
        }

        await tx.inventory.update({
          where: { id: existing.id },
          data: updateData,
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

