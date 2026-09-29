import { z } from "zod";

export const SupplierSchema = z.object({
  supplierCode: z.string().min(2),
  companyName: z.string().min(2),
  contactPerson: z.string().min(2),
  email: z.string().optional(),
  phone: z.string().min(10),
  address: z.string().min(5),
  city: z.string(),
  isActive: z.boolean().default(true),
});

export type SupplierInput = z.infer<typeof SupplierSchema>;
export type SupplierFormData = z.infer<typeof SupplierSchema>;
