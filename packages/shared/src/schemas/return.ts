import { z } from "zod";

export const ReturnItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  taxAmount: z.number().min(0),
  discount: z.number().min(0),
  note: z.string().optional(),
});

export const ReturnFormSchema = z.object({
  saleId: z.string().optional(),
  returnDate: z.string(),
  customerId: z.string().optional(),
  purchaseId: z.string().optional(),
  returnCode: z.string().min(3),
  returnType: z.enum(["SALE", "PURCHASE", "EXPIRED", "DAMAGED"]),
  reason: z.string().optional(),
  items: z.array(ReturnItemSchema).min(1),
}).refine(
  (data) => {
    if (data.returnType === "SALE") return !!data.saleId;
    if (data.returnType === "PURCHASE") return !!data.purchaseId;
    return true;
  },
  { message: "SALE returns require saleId, PURCHASE returns require purchaseId" }
);

export type ReturnFormInput = z.infer<typeof ReturnFormSchema>;
export type ReturnFormData = z.infer<typeof ReturnFormSchema>;
