import { z } from "zod";

export const PurchaseItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1),
  unitCost: z.number().min(0),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  taxPercent: z.number().min(0).max(100),
  itemDiscount: z.number().optional(),
});

export const PurchaseFormSchema = z.object({
  supplierId: z.string(),
  purchaseCode: z.string(),
  purchaseDate: z.string(),
  status: z.string(),
  discount: z.number().optional(),
  taxAmount: z.number().optional(),
  items: z.array(PurchaseItemSchema).min(1),
});

export type PurchaseFormInput = z.infer<typeof PurchaseFormSchema>;
export type PurchaseFormData = z.infer<typeof PurchaseFormSchema>;
