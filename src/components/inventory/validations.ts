import { z } from "zod";

export const bulkInventoryItemSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "Product name is required"),
  sku: z.string().trim().min(1, "SKU is required"),
  category: z.string().trim().min(1, "Category is required"),
  price: z
    .number({ message: "Price must be a number" })
    .min(0, "Price cannot be negative"),
  stock: z
    .number({ message: "Stock must be a number" })
    .min(0, "Stock cannot be negative"),
  minStock: z
    .number({ message: "Min stock must be a number" })
    .min(0, "Min stock cannot be negative"),
  supplierId: z.string().trim().min(1, "Supplier is required"),
  status: z.enum(["active", "inactive", "discontinued"]),
});

export const bulkInventorySchema = z.object({
  products: z
    .array(bulkInventoryItemSchema)
    .min(1, "At least one product is required"),
});

export type BulkInventory = z.infer<typeof bulkInventorySchema>;
export type BulkInventoryItem = z.infer<typeof bulkInventoryItemSchema>;
