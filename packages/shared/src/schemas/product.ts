import { z } from "zod";

export const ProductSchema = z.object({
  name: z.string().min(2),
  productCode: z.string().min(3),
  category: z.string(),
  unit: z.string(),
  brand: z.string(),
  description: z.string().optional(),
  unitCost: z.string().transform(Number),
  unitPrice: z.string().transform(Number),
  isActive: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof ProductSchema>;
export type ProductFormData = z.infer<typeof ProductSchema>;
