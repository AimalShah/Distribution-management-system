import { z } from "zod";

export const CustomerSchema = z.object({
  customerCode: z.string(),
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  creditLimit: z.string().transform(Number),
  isActive: z.boolean().default(true),
});

export type CustomerInput = z.infer<typeof CustomerSchema>;
export type CustomerFormData = z.infer<typeof CustomerSchema>;
