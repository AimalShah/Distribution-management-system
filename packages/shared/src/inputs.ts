import { z } from "zod";

/**
 * Form-input helpers shared by the request schemas.
 *
 * The legacy forms post `""` for untouched fields, and a blank box is not the
 * same thing as a bad value, so nothing here rejects an empty string. What they
 * do disagree about is what "absent" should become, and that choice decides
 * whether a PUT can clear a field:
 *
 * - `undefined` means "no opinion, leave the column alone". Prisma skips any
 *   key set to `undefined`, which is what makes an omitted field a true no-op.
 * - `null` means "write NULL and clear the column".
 *
 * Use the first family for a field that is always present on the form and only
 * blank when the user never touched it. Use the second when blanking the box
 * is a real edit the user expects to stick.
 */
const emptyToUndefined = (value: unknown) =>
  value === null || value === "" ? undefined : value;

/** A field the form always sends; an untouched box must not become an error. */
export const optionalText = (message: string) =>
  z.preprocess(emptyToUndefined, z.string().trim().min(1, message).optional());

/**
 * Trim first, then treat a blank as clear. Without the trim a whitespace-only
 * value is a non-empty string and would be stored as the address, which is not
 * what anyone typing into a blank box means.
 */
const blankToNull = (value: unknown) => {
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return undefined;
};

export const nullableText = (message: string) =>
  z.preprocess(blankToNull, z.string().min(1, message).nullable().optional());

export const nullableEmail = z.preprocess(
  blankToNull,
  z.email("Enter a valid email address").nullable().optional()
);

/**
 * `z.coerce.date()` accepts an ISO string or a real `Date` and rejects
 * unparseable text. A required date maps null and "" to NaN so they fail
 * validation instead of silently becoming the epoch, since coercing `null` on
 * its own yields 1970-01-01.
 */
export const requiredDate = z.preprocess(
  (value) => (value === null || value === "" ? Number.NaN : value),
  z.coerce.date()
);

export const optionalDate = z.preprocess(
  (value) =>
    value === null || value === "" || value === undefined ? undefined : value,
  z.coerce.date().optional()
);

/** Optional numbers arrive as 0 or not at all; "" and null mean "not provided". */
export const optionalNumber = z.preprocess(
  emptyToUndefined,
  z.number("Expected a number").optional()
);

/** Optional money is never negative, matching the legacy `.min(0)` guards. */
export const optionalMoney = optionalNumber.pipe(z.number().min(0).optional());

/**
 * Money that also accepts the string an HTML number input posts. `unitCost` and
 * `unitPrice` already needed this for products, and a customer credit limit
 * comes out of the same kind of box, so a numeric string is a value here rather
 * than a type error.
 *
 * Blank clears the column, and `0` is kept as `0` — a limit of zero is a real
 * limit, distinct from never having set one.
 */
export const nullableMoneyInput = (label: string) =>
  z.preprocess(
    (value) => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        // `Number("abc")` is NaN, which the number check below rejects.
        return trimmed === "" ? null : Number(trimmed);
      }
      return value;
    },
    z
      .number(`${label} must be a number`)
      .min(0, `${label} must be 0 or more`)
      .nullable()
      .optional()
  );

/** Tax percentages are a percentage, so they are capped at 100. */
export const optionalPercent = optionalNumber.pipe(
  z.number().min(0).max(100).optional()
);
