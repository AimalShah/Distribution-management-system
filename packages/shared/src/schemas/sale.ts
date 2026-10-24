import { z } from "zod";
import { optionalDate, optionalMoney, optionalPercent } from "../inputs";
import { paginationQuerySchema } from "../pagination";

export const SaleStatus = ["Pending", "Completed", "Cancelled"] as const;

export const SaleInvoiceItemSchema = z.object({
  productId: z.string().trim().min(1, "Please select a product"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  // The one money field the caller is trusted with: the operator's stated GST
  // rate for the line (`taxPercent` only applies while > 0; unlike the removed
  // split fields below, it is a rate the form previews with, not a figure the
  // API banks). Every amount is derived server-side from this and the product
  // row's own rate — see `calculateSaleBreakdown`.
  taxPercent: optionalPercent,
});

/**
 * The shipped schema described `saleItems` with a client computed `totalPrice`
 * and a display only `productName`, while `src/services/saleInvoice.ts` and the
 * `SaleItem` model use `items` with a server computed `totalPrice` and no
 * `productName` column. This describes what the service actually consumes; the
 * legacy form's payload validates against it once renamed.
 */
export const SaleInvoiceSchema = z.object({
  saleCode: z.string().trim().optional(),
  customerId: z.string().trim().min(1, "Please select a customer"),
  // Absent means "now", which is the column default. The legacy form always
  // sent `new Date()` and ignored anything the user picked.
  saleDate: optionalDate,
  status: z.enum(SaleStatus),
  invoiceType: z.enum(["regular", "tax"]).default("regular"),
  isInterState: z.boolean().default(false),
  // The caller supplies the trade terms (line prices, per-line rate
  // statements, the invoice discount) and may not supply figures: the
  // CGST/SGST/IGST split, the tax and the total are derived from those terms
  // server-side, so nothing a hostile or buggy client sends can bank a GST
  // number the terms do not support.
  discount: optionalMoney,
  /**
   * Set by the client only after it has seen the credit-limit warning and the
   * user asked to proceed anyway. The route requires `sales.override_credit_limit`
   * when this is true, so the flag alone does not override anything (ADR 0005).
   */
  overrideCreditLimit: z.boolean().optional(),
  items: z.array(SaleInvoiceItemSchema).min(1, "A sale needs at least one item"),
});

/**
 * Header columns only. `items` is omitted for the same reason as purchases:
 * rewriting lines without replaying the stock movement would leave
 * `Inventory.quantityOnHand` disagreeing with the sale rows.
 */
export const SaleUpdateSchema = SaleInvoiceSchema.partial()
  .omit({
    items: true,
    saleCode: true,
    // The override is a create-time decision, not a column; omitting it keeps
    // the update body from carrying a field the service would try to write.
    overrideCreditLimit: true,
  })
  .extend({
    invoiceType: z.enum(["regular", "tax"]).optional(),
    isInterState: z.boolean().optional(),
  });

export const saleListQuerySchema = paginationQuerySchema.extend({
  // An empty search box trims to "" and the service reads that as "no filter".
  search: z.string().trim().optional(),
  status: z.enum(SaleStatus).optional(),
  // `deleted=true` is the Deleted tab. Absent means active invoices only.
  deleted: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type SaleInvoiceItemInput = z.output<typeof SaleInvoiceItemSchema>;

export type SaleInvoiceInput = z.output<typeof SaleInvoiceSchema>;

export type SaleUpdateInput = z.output<typeof SaleUpdateSchema>;

export type SaleListQuery = z.output<typeof saleListQuerySchema>;

export type SaleInvoiceFormData = SaleInvoiceInput;
