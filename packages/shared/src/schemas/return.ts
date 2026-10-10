import { z } from "zod";
import { optionalDate, optionalText } from "../inputs";
import { paginationQuerySchema } from "../pagination";

export const ReturnTypes = ["SALE", "PURCHASE", "EXPIRED", "DAMAGED"] as const;

/**
 * The condition gate every returned line passes (ADR 0008). A restockable line
 * goes back on the shelf; a damaged one is recorded for the credit and the
 * customer's return history but is not put back on hand.
 */
export const ReturnConditions = ["RESTOCKABLE", "DAMAGED"] as const;

/**
 * A line of goods coming back.
 *
 * `ReturnItem.unitPrice`, `.taxAmount` and `.discount` are NOT NULL columns, so
 * all three stay required; the legacy form posted them for every line.
 *
 * `condition` and `reason` are the per-line condition gate: the header's
 * `reason` says why the return happened, and the line's says why *this* line is
 * restockable or damaged. `condition` defaults to `RESTOCKABLE` so a client that
 * has not been updated keeps the old "everything goes back on the shelf"
 * behaviour.
 */
export const ReturnItemSchema = z
  .object({
    productId: z.string().trim().min(1, "Please select a product"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    unitPrice: z.number("Expected a number").min(0, "Unit price cannot be negative"),
    taxAmount: z.number("Expected a number").min(0, "Tax amount cannot be negative"),
    discount: z.number("Expected a number").min(0, "Discount cannot be negative"),
    condition: z.enum(ReturnConditions).default("RESTOCKABLE"),
    note: optionalText("Note cannot be empty"),
    reason: optionalText("Reason cannot be empty"),
  })
  /**
   * A damaged line never goes back on the shelf, so it needs a reason the
   * client can act on; a restockable line does not (the header's reason covers
   * why the goods came back at all). This is the condition gate's other half.
   */
  .superRefine((item, ctx) => {
    if (item.condition === "DAMAGED" && !item.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Explain why this line is damaged",
      });
    }
  });

/**
 * Which document a return is allowed to be tied to, per type.
 *
 * `required` names the field a return of this type has to carry, `forbidden`
 * names the ones it must not. A SALE return reverses an invoice and a PURCHASE
 * return reverses a receipt; EXPIRED and DAMAGED are write-offs that stand on
 * their own.
 *
 * This is where the legacy `.refine()` stopped. It demanded a `saleId` for a
 * SALE return and a `purchaseId` for a PURCHASE return, and then
 * `src/services/return.ts` wrote neither column: `Return` had no such column to
 * write to, and `addReturn` passed only the codes, date, reason and items. The
 * check ran against a value that was discarded, so nothing held a return to the
 * document it claimed to reverse. `Return.saleId`/`.purchaseId` exist now, and
 * `forbidden` closes the other half of the gap: without it a client could name
 * a sale on a DAMAGED return, have it accepted, and watch it be dropped.
 */
const referenceRule: Record<
  (typeof ReturnTypes)[number],
  { required?: "saleId" | "purchaseId"; forbidden: ("saleId" | "purchaseId")[] }
> = {
  SALE: { required: "saleId", forbidden: ["purchaseId"] },
  PURCHASE: { required: "purchaseId", forbidden: ["saleId"] },
  EXPIRED: { forbidden: ["saleId", "purchaseId"] },
  DAMAGED: { forbidden: ["saleId", "purchaseId"] },
};

const labelFor = (field: "saleId" | "purchaseId") =>
  field === "saleId" ? "sale" : "purchase";

/**
 * Kept as a plain object rather than being folded into `ReturnCreateSchema` with
 * `.superRefine`, so the update schema can still `.omit()` off it.
 */
const returnBaseSchema = z.object({
  returnCode: z.string().trim().min(3, "Return code must be at least 3 characters"),
  returnType: z.enum(ReturnTypes),
  // Absent means "now", which is the column default. The legacy form always sent
  // `new Date()`, so the date the user picked was overwritten with the moment
  // they pressed submit.
  returnDate: optionalDate,
  reason: optionalText("Reason cannot be empty"),
  saleId: optionalText("Please select a sale"),
  purchaseId: optionalText("Please select a purchase"),
  items: z.array(ReturnItemSchema).min(1, "A return needs at least one item"),
});

export const ReturnCreateSchema = returnBaseSchema.superRefine((data, ctx) => {
  const rule = referenceRule[data.returnType];

  if (rule.required && !data[rule.required]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [rule.required],
      message: `Please select the ${labelFor(rule.required)} this return is reversing`,
    });
  }

  for (const field of rule.forbidden) {
    if (data[field]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `A ${data.returnType} return is not tied to a ${labelFor(field)}`,
      });
    }
  }
});

/**
 * Header columns only, and deliberately narrower than the create schema.
 *
 * - `items` is omitted for the same reason as sales and purchases: rewriting the
 *   lines would leave `Inventory.quantityOnHand` disagreeing with the movements
 *   the original return already made.
 * - `returnType` is immutable because it decides the direction of the stock
 *   movement. `updateReturn` let it change freely, so a return could be relabelled
 *   from a customer handback to a write-off while the ledger still recorded the
 *   stock coming back in. Changing it needs the original movement reversed and a
 *   new one written, which is the reversal flow `DELETE` implements instead.
 * - `saleId`/`purchaseId` are immutable because they are what the returned
 *   quantity is checked against; re-pointing a return would re-open a document
 *   whose already-returned total has been counted against the wrong figure.
 */
export const ReturnUpdateSchema = returnBaseSchema
  .omit({ returnType: true, saleId: true, purchaseId: true, items: true })
  .partial()
  /**
   * Unknown keys are refused rather than stripped.
   *
   * Every field this schema does not own was just removed for a reason, so a body
   * made only of those fields parses to `{}`: the route would answer 200 having
   * changed nothing, and a client that sent `returnType` would be told its
   * relabelling worked. The legacy update's `Partial<ReturnFormData>` was exactly
   * that shape, and it is how a return came to be relabelled from a customer
   * handback to a write-off with the ledger still recording the stock coming back
   * in. A 400 naming the field is the answer the caller needs.
   */
  .strict();

export const returnListQuerySchema = paginationQuerySchema.extend({
  // An empty search box trims to "" and the service reads that as "no filter".
  search: z.string().trim().optional(),
  returnType: z.enum(ReturnTypes).optional(),
  // `deleted=true` is the Deleted tab. Absent means active returns only, so no
  // existing caller starts seeing soft-deleted rows by default.
  deleted: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// Named `ReturnTypeValue` rather than `ReturnType`, which is a TypeScript
// built-in utility type and would shadow it on every import.
export type ReturnTypeValue = (typeof ReturnTypes)[number];

export type ReturnConditionValue = (typeof ReturnConditions)[number];

export type ReturnItemInput = z.output<typeof ReturnItemSchema>;

export type ReturnCreateInput = z.output<typeof ReturnCreateSchema>;

export type ReturnUpdateInput = z.output<typeof ReturnUpdateSchema>;

export type ReturnListQuery = z.output<typeof returnListQuerySchema>;

export type ReturnFormData = ReturnCreateInput;
