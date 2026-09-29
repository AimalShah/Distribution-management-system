import { z } from "zod";

export const SaleInvoiceItemSchema = z.object({
  productId: z.string(),
  productName: z.string().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  totalPrice: z.number().min(0),
  taxPercent: z.number().optional(),
});

export const SaleInvoiceSchema = z.object({
  saleCode: z.string(),
  customerId: z.string(),
  taxAmount: z.number().optional(),
  discount: z.number().optional(),
  status: z.enum(["Pending", "Completed", "Cancelled"]),
  saleItems: z.array(SaleInvoiceItemSchema).min(1),
});

export type SaleInvoiceInput = z.infer<typeof SaleInvoiceSchema>;
export type SaleInvoiceFormData = z.infer<typeof SaleInvoiceSchema>;
