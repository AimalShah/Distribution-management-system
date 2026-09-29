import { z } from "zod";

export const CategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export type CategoryInput = z.infer<typeof CategorySchema>;
export type CategoryFormData = z.infer<typeof CategorySchema>;
