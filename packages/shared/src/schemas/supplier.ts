import { z } from "zod";
import { nullableEmail, nullableText } from "../inputs";
import { paginationQuerySchema } from "../pagination";

/**
 * `phone`, `address` and `city` are optional here even though both the legacy
 * form schema and the old shared schema required them, because the three other
 * sources that describe this model agree they are not:
 *
 * - the Prisma model declares all three as `String?`
 * - `src/types/supplier.d.ts` marks them optional
 * - `src/services/supplier.ts` writes `data.phone || null`, which is code that
 *   only makes sense if they can be absent
 *
 * So a supplier with no phone number was always storable, and the old shared
 * schema was the only thing standing in the way. Their length rules (phone at
 * least 10, address at least 5) are phone-format and address-format rules
 * rather than anything about the column, so they belong to the form. Tightening
 * this back up is a business decision, not a port.
 *
 * The two-character minimums on the three required fields are kept, because the
 * form schema and the old shared schema both asked for them.
 */
const supplierFields = {
  supplierCode: z.string().trim().min(2, "Supplier code must be at least 2 characters"),
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters"),
  contactPerson: z
    .string()
    .trim()
    .min(2, "Contact person must be at least 2 characters"),
  email: nullableEmail,
  phone: nullableText("Phone number cannot be empty"),
  address: nullableText("Address cannot be empty"),
  city: nullableText("City cannot be empty"),
  isActive: z.boolean(),
};

export const SupplierSchema = z.object(supplierFields).extend({
  // Absent means active, which is the column default.
  isActive: z.boolean().default(true),
});

/**
 * Derived from the field map rather than from `SupplierSchema.partial()`, which
 * would keep `isActive`'s `.default(true)` and so reactivate a deactivated
 * supplier on every unrelated edit.
 */
export const SupplierUpdateSchema = z.object(supplierFields).partial();

export const supplierListQuerySchema = paginationQuerySchema.extend({
  // An empty search box is not an error: it trims to "" and the service reads
  // that as "no filter".
  search: z.string().trim().optional(),
  // Not `z.coerce.boolean()`: that maps the string "false" to true.
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type SupplierInput = z.output<typeof SupplierSchema>;

export type SupplierUpdateInput = z.output<typeof SupplierUpdateSchema>;

export type SupplierListQuery = z.output<typeof supplierListQuerySchema>;

export type SupplierFormData = SupplierInput;
