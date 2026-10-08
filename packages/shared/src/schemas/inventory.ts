import { z } from "zod";
import { paginationQuerySchema } from "../pagination";

/**
 * Mirrors the `InventoryMovement` enum in `packages/db/prisma/schema.prisma`.
 * `IN` and `OUT` are written by the purchase and sale services; the rest are
 * driven from this module's adjustment endpoint.
 */
export const InventoryMovementValues = [
  "IN",
  "OUT",
  "ADJUSTMENT",
  "TRANSFER",
  "RETURN",
  "DAMAGED",
  "EXPIRED",
] as const;

export type InventoryMovementValue = (typeof InventoryMovementValues)[number];

/**
 * Stock levels are physical counts, so every field is a whole number of zero or
 * more. The legacy service used `value || 0` on write, which turned an explicit
 * `0` into the default and a `null` maximum into `null`; the service here uses
 * `??` so a deliberate zero survives.
 */
const stockLevel = (label: string) =>
  z.number().int().min(0, `${label} must be zero or more`);

export const InventoryCreateSchema = z.object({
  productId: z.string().trim().min(1, "Please select a product"),
  quantityOnHand: stockLevel("Quantity on hand"),
  quantityReserved: stockLevel("Reserved quantity").optional(),
  reorderLevel: stockLevel("Reorder level").optional(),
  maxStockLevel: stockLevel("Maximum stock level").optional(),
});

/**
 * `quantity` is a magnitude for the directional movements (`IN`, `RETURN` add;
 * `OUT`, `DAMAGED`, `EXPIRED` subtract) and an absolute counted total for
 * `ADJUSTMENT`. That is why zero is allowed here: a physical count can
 * legitimately find no stock. The service rejects a directional movement of
 * zero, because a movement that moves nothing is not a movement.
 */
export const InventoryAdjustSchema = z.object({
  inventoryId: z.string().trim().min(1, "Inventory id is required"),
  movementType: z.enum(InventoryMovementValues),
  quantity: stockLevel("Quantity"),
  reason: z.string().trim().min(1, "A reason is required"),
});

/**
 * A settings call that changes nothing is almost always a client bug, so at
 * least one field is required. The service sends only the fields present.
 */
export const InventorySettingsSchema = z
  .object({
    reorderLevel: stockLevel("Reorder level").optional(),
    maxStockLevel: stockLevel("Maximum stock level").optional(),
    quantityReserved: stockLevel("Reserved quantity").optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Provide at least one setting to update",
  });

export const inventoryListQuerySchema = paginationQuerySchema;

export const inventoryLogsQuerySchema = paginationQuerySchema.extend({
  // An empty filter box trims to "" and the service reads that as "no filter",
  // which is why this is `.optional()` rather than `.min(1)`.
  productId: z.string().trim().optional(),
});

export const lowStockQuerySchema = paginationQuerySchema;

export const batchListQuerySchema = paginationQuerySchema.extend({
  productId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  expiringWithinDays: z.coerce.number().int().min(1).optional(),
});

export const stockBatchCreateSchema = z.object({
  productId: z.string().trim().min(1, "Product is required"),
  batchNumber: z.string().trim().min(1, "Batch number is required"),
  expiryDate: z.coerce.date().optional(),
  quantity: z.number().int().min(0, "Quantity must be zero or more"),
  unitCost: z.number().min(0, "Unit cost must be zero or more").optional(),
});

export const inventoryBulkImportRowSchema = z.object({
  productCode: z.string().trim().min(1, "Product code is required"),
  productName: z.string().trim().optional(),
  quantityOnHand: z.coerce.number().int().min(0, "Quantity on hand must be zero or more"),
  reorderLevel: z.coerce.number().int().min(0, "Reorder level must be zero or more").optional(),
  maxStockLevel: z.coerce.number().int().min(0, "Maximum stock level must be zero or more").optional(),
});

export const inventoryBulkImportSchema = z.object({
  rows: z.array(inventoryBulkImportRowSchema).min(1, "At least one row is required"),
});

export type InventoryCreateInput = z.output<typeof InventoryCreateSchema>;

export type InventoryAdjustInput = z.output<typeof InventoryAdjustSchema>;

export type InventorySettingsInput = z.output<typeof InventorySettingsSchema>;

export type InventoryListQuery = z.output<typeof inventoryListQuerySchema>;

export type InventoryLogsQuery = z.output<typeof inventoryLogsQuerySchema>;

export type LowStockQuery = z.output<typeof lowStockQuerySchema>;

export type BatchListQuery = z.output<typeof batchListQuerySchema>;

export type StockBatchCreateInput = z.output<typeof stockBatchCreateSchema>;

export type InventoryBulkImportRow = z.output<typeof inventoryBulkImportRowSchema>;

export type InventoryBulkImportInput = z.output<typeof inventoryBulkImportSchema>;

