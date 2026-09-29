import { z } from "zod";

export const InventoryAdjustSchema = z.object({
  inventoryId: z.string(),
  movementType: z.enum(["IN", "OUT", "ADJUSTMENT", "TRANSFER", "RETURN", "DAMAGED", "EXPIRED"]),
  quantity: z.number().int(),
  reason: z.string(),
});

export const InventorySettingsSchema = z.object({
  reorderLevel: z.number().int().optional(),
  maxStockLevel: z.number().int().optional(),
  quantityReserved: z.number().int().optional(),
});

export type InventoryAdjustInput = z.infer<typeof InventoryAdjustSchema>;
export type InventorySettingsInput = z.infer<typeof InventorySettingsSchema>;
