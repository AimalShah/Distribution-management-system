import { z } from "zod";
import { nullableText } from "../inputs";

/**
 * The GSTIN printed on a Company's documents. The column accepts any string, so
 * the shape is enforced here: exactly the 15-character GSTIN pattern when one is
 * supplied, and blank clears it. Kept as a preprocess so an untouched box ("" or
 * null) clears rather than fails.
 */
const gstin = z.preprocess(
  (value) => {
    if (value === null) return null;

    if (typeof value === "string") {
      const trimmed = value.trim().toUpperCase();

      return trimmed === "" ? null : trimmed;
    }

    return undefined;
  },
  z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
      "Enter a valid 15-character GSTIN"
    )
    .nullable()
    .optional()
);

/**
 * The per-Company settings the Settings page edits.
 *
 * Every field is optional so a PUT can update one thing without restating the
 * rest; Prisma skips `undefined` keys, which is what makes an omitted field a
 * true no-op. `displayName`, `address` and `gstin` clear on blank because the
 * boxes are meant to be emptied; the policy numbers and SKU format never clear,
 * because there is no sensible "no return window".
 *
 * `skuFormat` and `skuSeparator` are free text here. Their tokens are validated
 * by `parseSkuFormat` in `sku.ts`, which the service calls before storing, so a
 * malformed token is refused with the token named rather than silently stored.
 */
export const companySettingsUpdateSchema = z.object({
  displayName: nullableText("Display name cannot be blank"),
  address: nullableText("Address cannot be blank"),
  gstin,
  skuFormat: z.string().trim().min(1, "SKU format is required").max(120).optional(),
  skuSeparator: z.string().trim().min(1, "Separator is required").max(3).optional(),
  returnWindowDays: z.coerce
    .number()
    .int("Return window must be a whole number of days")
    .min(0)
    .max(3650)
    .optional(),
  returnsEnabled: z.boolean().optional(),
  creditTermDays: z.coerce
    .number()
    .int("Credit term must be a whole number of days")
    .min(0)
    .max(3650)
    .optional(),
});

export type CompanySettingsUpdateInput = z.output<typeof companySettingsUpdateSchema>;
