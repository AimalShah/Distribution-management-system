import { z } from "zod";
import { optionalDate, optionalMoney, optionalPercent } from "../inputs";
import { paginationQuerySchema } from "../pagination";

export const SaleStatus = ["Pending", "Completed", "Cancelled"] as const;

export const SaleInvoiceItemSchema = z.object({
  productId: z.string().trim().min(1, "Please select a product"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  taxPercent: optionalPercent,
  cgstRate: optionalPercent,
  sgstRate: optionalPercent,
  igstRate: optionalPercent,
  cgstAmount: optionalMoney,
  sgstAmount: optionalMoney,
  igstAmount: optionalMoney,
});

/**
 * The shipped schema described `saleItems` with a client computed `totalPrice`
 * and a display only `productName`, while `src/services/saleInvoice.ts` and the
 * `SaleItem` model use `items` with a server computed `totalPrice` and no
 * `productName` column. This describes what the service actually consumes; the
 * legacy form's payload validates against it once renamed.
 */
export const SaleInvoiceSchema = z.object({
  saleCode: z.string().trim().min(1, "Sale code is required"),
  customerId: z.string().trim().min(1, "Please select a customer"),
  // Absent means "now", which is the column default. The legacy form always
  // sent `new Date()` and ignored anything the user picked.
  saleDate: optionalDate,
  status: z.enum(SaleStatus),
  invoiceType: z.enum(["regular", "tax"]).default("regular"),
  isInterState: z.boolean().default(false),
  discount: optionalMoney,
  taxAmount: optionalMoney,
  cgstAmount: optionalMoney,
  sgstAmount: optionalMoney,
  igstAmount: optionalMoney,
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
