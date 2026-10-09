import { z } from "zod";
import { paginationQuerySchema } from "../pagination";

/**
 * Money arrives as a string from HTML form inputs and as a number from JSON
 * clients. The legacy `src/validations/schemas.ts` only accepted strings and
 * guarded the transform with a `!isNaN` refine, so `Number("")` and negative
 * amounts were rejected. Accept both representations and keep those guards.
 */
const moneyInput = (label: string) =>
  z
    .union([z.number(), z.string().trim().min(1, `${label} is required`)])
    .transform((value) => (typeof value === "number" ? value : Number(value)))
    .refine((value) => Number.isFinite(value) && value >= 0, {
      message: `${label} must be a valid positive number`,
    });

export const ProductSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters"),
  /**
   * The product's SKU (ADR 0007). Optional on create: when absent the server
   * generates it from the Company's configured format. A client that still sends
   * one has it honoured so legacy callers and imports keep working, but the
   * update schema refuses it — the SKU is immutable once a product exists.
   */
  productCode: z
    .string()
    .trim()
    .min(3, "Product code must be at least 3 characters")
    .optional(),
  // `category` and `brand` carry the categoryId / brandId. The legacy form and
  // `src/services/product.ts` pass the relation id under these names.
  category: z.string().trim().min(1, "Please select a category"),
  unit: z.string().trim().min(1, "Please select a unit"),
  brand: z.string().trim().min(1, "Brand is required"),
  description: z.string().trim().optional(),
  unitCost: moneyInput("Unit cost"),
  unitPrice: moneyInput("Unit price"),
  isActive: z.boolean().default(true),
  gstApplicable: z.boolean().optional(),
  gstRate: z
    .union([z.number(), z.string().trim()])
    .transform((value) => (typeof value === "number" ? value : value === "" ? 0 : Number(value)))
    .refine((value) => Number.isFinite(value) && value >= 0, {
      message: "GST rate must be a valid positive number",
    })
    .optional(),
});

/**
 * `ProductSchema.partial()` keeps `isActive`'s `.default(true)`, so a PUT that
 * omits `isActive` would silently reactivate an archived product. Overriding the
 * field with a plain optional boolean is what makes PUT a true partial update.
 *
 * `productCode` is omitted entirely: the SKU is immutable once assigned
 * (ADR 0007), so an edit that sends one is ignored rather than allowed to
 * re-point a product at a code other rows or documents may reference.
 */
export const ProductUpdateSchema = ProductSchema.partial()
  .omit({ productCode: true })
  .extend({
    isActive: z.boolean().optional(),
  });

export const productListQuerySchema = paginationQuerySchema.extend({
  // An empty search box is not an error: it trims to "" and the service reads
  // that as "no filter".
  search: z.string().trim().optional(),
  // Not `z.coerce.boolean()`: that maps the string "false" to true.
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  // Filters the catalogue to one brand (issue #45). An empty value is rejected
  // rather than ignored: a cleared dropdown means "no brand".
  brandId: z.string().trim().min(1, "Brand filter cannot be empty").optional(),
});

export type ProductInput = z.output<typeof ProductSchema>;

export type ProductUpdateInput = z.output<typeof ProductUpdateSchema>;

export type ProductListQuery = z.output<typeof productListQuerySchema>;

export type ProductFormData = ProductInput;
