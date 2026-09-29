import { z } from "zod";
import {
  optionalDate,
  optionalMoney,
  optionalPercent,
  optionalText,
  requiredDate,
} from "../inputs";
import { paginationQuerySchema } from "../pagination";

export const PurchaseItemInputSchema = z.object({
  productId: z.string().trim().min(1, "Please select a product"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitCost: z.number().min(0, "Unit cost must be positive"),
  batchNumber: optionalText("Batch number is required"),
  expiryDate: optionalDate,
  taxPercent: optionalPercent,
  itemDiscount: optionalMoney,
});

export const PurchaseFormSchema = z.object({
  supplierId: z.string().trim().min(1, "Please select a supplier"),
  purchaseCode: z.string().trim().min(1, "Purchase code is required"),
  purchaseDate: requiredDate,
  status: z.string().trim().min(1, "Please select a status"),
  discount: optionalMoney,
  taxAmount: optionalMoney,
  items: z
    .array(PurchaseItemInputSchema)
    .min(1, "A purchase needs at least one item"),
});

/**
 * `items` is intentionally not updatable. The legacy `updatePurchase` only
 * touched header columns, and changing line items without replaying the stock
 * movement would leave `Inventory.quantityOnHand` out of step with the purchase
 * rows. Line-item editing needs its own inventory reconciliation flow.
 */
export const PurchaseUpdateSchema = PurchaseFormSchema.partial().omit({
  items: true,
});

export const purchaseListQuerySchema = paginationQuerySchema.extend({
  // An empty search box trims to "" and the service reads that as "no filter".
  search: z.string().trim().optional(),
});

export type PurchaseItemInput = z.output<typeof PurchaseItemInputSchema>;
export type PurchaseFormInput = z.output<typeof PurchaseFormSchema>;
export type PurchaseUpdateInput = z.output<typeof PurchaseUpdateSchema>;
export type PurchaseListQuery = z.output<typeof purchaseListQuerySchema>;
export type PurchaseFormData = PurchaseFormInput;
