import { z } from "zod";
import { nullableText } from "../inputs";
import { paginationQuerySchema } from "../pagination";

export const OrderBookerSchema = z.object({
  code: z.string().trim().min(1, "Code is required"),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone: nullableText("Phone cannot be empty"),
  isActive: z.boolean().default(true),
});

export const OrderBookerUpdateSchema = OrderBookerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const orderBookerListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type OrderBookerInput = z.output<typeof OrderBookerSchema>;
export type OrderBookerUpdateInput = z.output<typeof OrderBookerUpdateSchema>;
export type OrderBookerListQuery = z.output<typeof orderBookerListQuerySchema>;
export type OrderBookerFormData = OrderBookerInput;
