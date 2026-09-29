import { z } from "zod";

/**
 * The legacy forms post `""` for untouched optional text and date fields, and
 * `new Date("")` is an Invalid Date rather than an absent value. These helpers
 * keep `""` and null meaning "not provided" instead of turning a blank form
 * field into a validation error.
 */
const emptyToUndefined = (value: unknown) =>
  value === null || value === "" ? undefined : value;

export const optionalText = (message: string) =>
  z.preprocess(emptyToUndefined, z.string().trim().min(1, message).optional());

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

/** Tax percentages are a percentage, so they are capped at 100. */
export const optionalPercent = optionalNumber.pipe(
  z.number().min(0).max(100).optional()
);
