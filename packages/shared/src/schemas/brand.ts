import { z } from "zod";

export const BrandSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
});

export type BrandInput = z.infer<typeof BrandSchema>;
export type BrandFormData = z.infer<typeof BrandSchema>;
