import { z } from "zod";
import { nullableEmail, nullableMoneyInput, nullableText, optionalDate } from "../inputs";
import { paginationQuerySchema } from "../pagination";

/**
 * Shared by create and update so both agree on what a blank field means.
 *
 * The blank-to-null helpers matter most on update: Prisma reads `undefined` as
 * "leave this column alone", so a schema that mapped a cleared box to
 * `undefined` could never actually empty a field that already had a value. A
 * customer whose phone number was deleted from the form would have kept the old
 * one, with no error to explain it.
 */
const customerFields = {
  // The shared schema checked none of this before: any string passed as an
  // email, and a code of "  " satisfied `z.string()`.
  customerCode: z.string().trim().min(1, "Customer code is required"),
  name: z.string().trim().min(1, "Name is required"),
  email: nullableEmail,
  phone: nullableText("Phone number cannot be empty"),
  address: nullableText("Address cannot be empty"),
  city: nullableText("City cannot be empty"),
  /**
   * The legacy form posted this as a string and the service ran
   * `data.creditLimit ? Number(data.creditLimit) : null`, so a customer whose
   * limit was exactly 0 was stored with no limit at all. `null` now means only
   * "never recorded", which leaves 0 expressible as "no credit".
   */
  creditLimit: nullableMoneyInput("Credit limit"),
  /**
   * A per-customer override of the Company's default credit term (ADR 0009).
   * Blank means "use the Company default", so it clears to `null` rather than
   * being written as 0, which would make every sale due on the day it was made.
   */
  creditTermDays: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        const trimmed = value.trim();

        return trimmed === "" ? null : Number(trimmed);
      }

      return value;
    },
    z
      .number("Credit term must be a number")
      .int("Credit term must be a whole number of days")
      .min(0, "Credit term must be 0 or more days")
      .max(3650, "Credit term cannot exceed 3650 days")
      .nullable()
      .optional()
  ),
  isActive: z.boolean(),
};

export const CustomerSchema = z.object(customerFields).extend({
  // Absent means active, which is the column default.
  isActive: z.boolean().default(true),
});

/**
 * `CustomerSchema.partial()` would keep `isActive`'s `.default(true)`, so a PUT
 * that omits `isActive` would silently reactivate a deactivated customer.
 * Deriving the update schema from the field map instead leaves `isActive` a
 * plain optional boolean, which is what makes PUT a true partial update.
 *
 * Unlike the return update, this is not `.strict()`: every column on Customer is
 * legitimately editable here, so there is no field a client could send that this
 * schema has quietly dropped, and no body that strips down to a silent no-op.
 */
export const CustomerUpdateSchema = z.object(customerFields).partial();

export const customerListQuerySchema = paginationQuerySchema.extend({
  // An empty search box is not an error: it trims to "" and the service reads
  // that as "no filter".
  search: z.string().trim().optional(),
  // Not `z.coerce.boolean()`: that maps the string "false" to true.
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

/**
 * The window a statement is rendered for.
 *
 * `to` alone is the "as of" statement (everything up to a date, opening balance
 * zero); both bounds give a period statement whose opening balance is what was
 * already owed when the window opened. Neither is required: no bounds means the
 * customer's full history.
 */
export const customerLedgerQuerySchema = z.object({
  from: optionalDate,
  to: optionalDate,
});

export type CustomerInput = z.output<typeof CustomerSchema>;

export type CustomerUpdateInput = z.output<typeof CustomerUpdateSchema>;

export type CustomerListQuery = z.output<typeof customerListQuerySchema>;

export type CustomerLedgerQuery = z.output<typeof customerLedgerQuerySchema>;

export type CustomerFormData = CustomerInput;
