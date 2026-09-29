import { z } from "zod";

/**
 * The window every report accepts, in every report family.
 *
 * `z.coerce.date()` rather than `z.string()`: it is the one place where coercion
 * is what is wanted, because an HTTP query string is always a string and
 * `z.coerce.date()` runs the same parse `new Date(value)` would while producing
 * a `Date` for the service. What it will not do is paper over a value that is
 * not a date at all — `"last-tuesday"` is rejected, which is the point. The
 * legacy took `startDate` and `endDate` as required parameters and did
 * `new Date(undefined)` when they were absent, which is an `Invalid Date`, and
 * then compared it: every `createdAt >= Invalid Date` is false, so the report
 * came back empty and looked like a tenant with no stock. The purchase reports
 * did the same with `purchaseDate`, for the same reason.
 *
 * Both are optional rather than required, because several reports are about the
 * present rather than about a period — what is on hand, what is below its
 * reorder level — and forcing a window on them would mean asking a question the
 * caller does not have. A report that ignores the window it was given is worse
 * than one that insists on it, so the ones that read it document what they do
 * with it and the ones that do not, say so.
 *
 * `superRefine` for the ordering rather than a field-level rule, because "start
 * is after end" is a statement about the pair and no single field can express it.
 * The legacy never checked, and a reversed range silently returned the empty set
 * for the same reason an unparseable one did.
 */
export const reportRangeQuerySchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .superRefine(({ startDate, endDate }, ctx) => {
    if (startDate && endDate && startDate > endDate) {
      ctx.addIssue({
        code: "custom",
        message: "startDate must not be after endDate",
        path: ["startDate"],
      });
    }
  });

/**
 * `daysUntilExpiry` is a query parameter, so it arrives as a string. The legacy
 * guarded it with `Number.isFinite(daysUntilExpiry)`, which is `false` for
 * `"30"` — a string is never finite — so the threshold silently did nothing for
 * every caller that reached it over HTTP, and the expiry report was always
 * "expiring by the end of the window" regardless of what was asked for.
 *
 * Coerced, then bounded to a non-negative integer. A negative threshold would
 * put `expiryLimit` before `windowEnd` and silently return fewer rows rather
 * than failing, and a fractional day count is not a thing a caller means.
 */
export const reportExpiryQuerySchema = reportRangeQuerySchema.extend({
  daysUntilExpiry: z.coerce
    .number()
    .int("daysUntilExpiry must be a whole number of days")
    .min(0, "daysUntilExpiry cannot be negative")
    .max(3650, "daysUntilExpiry cannot exceed 3650")
    .optional(),
});

export const inventoryBasicQuerySchema = reportRangeQuerySchema;
export const inventoryMovementsQuerySchema = reportRangeQuerySchema;
export const inventoryLowStockQuerySchema = reportRangeQuerySchema;
export const inventoryStockValuationQuerySchema = reportRangeQuerySchema;
export const inventoryExpiryQuerySchema = reportExpiryQuerySchema;
export const inventoryFullQuerySchema = reportExpiryQuerySchema;

export const purchaseBasicQuerySchema = reportRangeQuerySchema;
export const purchaseBySupplierQuerySchema = reportRangeQuerySchema;
export const purchaseByProductQuerySchema = reportRangeQuerySchema;
export const purchaseFullQuerySchema = reportRangeQuerySchema;

export type ReportRangeQuery = z.output<typeof reportRangeQuerySchema>;
export type InventoryReportQuery = z.output<typeof reportRangeQuerySchema>;
export type InventoryExpiryQuery = z.output<typeof reportExpiryQuerySchema>;
export type PurchaseReportQuery = z.output<typeof reportRangeQuerySchema>;
