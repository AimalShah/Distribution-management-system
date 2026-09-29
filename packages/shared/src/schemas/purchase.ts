import { z } from "zod";
import { paginationQuerySchema } from "../pagination";

/**
 * The legacy `src/components/PurchaseForm.tsx` posts `batchNumber: ""` and
 * `expiryDate: ""` for untouched optional fields, and `new Date("")` is an
 * Invalid Date rather than an absent value. These helpers keep "" / null
 * meaning "not provided" instead of turning a blank form field into a 400.
 */
const emptyToUndefined = (value: unknown) =>
  value === null || value === "" ? undefined : value;

const optionalText = (message: string) =>
  z.preprocess(emptyToUndefined, z.string().trim().min(1, message).optional());

/**
 * `z.coerce.date()` accepts an ISO string or a real `Date`, and rejects
 * unparseable text. A required date maps null / "" to NaN so they fail
 * validation rather than silently becoming the epoch (coercing `null` on its
 * own yields 1970-01-01).
 */
const requiredDate = z.preprocess(
  (value) => (value === null || value === "" ? Number.NaN : value),
  z.coerce.date()
);

const optionalDate = z.preprocess(
  (value) =>
    value === null || value === "" || value === undefined ? undefined : value,
  z.coerce.date().optional()
);

/** Optional numbers arrive as 0 or are absent; "" / null mean "not provided". */
const optionalNumber = z.preprocess(
  emptyToUndefined,
  z.number("Expected a number").optional()
);

export const PurchaseItemInputSchema = z.object({
  productId: z.string().trim().min(1, "Please select a product"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitCost: z.number().min(0, "Unit cost must be positive"),
  batchNumber: optionalText("Batch number is required"),
  expiryDate: optionalDate,
  taxPercent: optionalNumber.pipe(z.number().min(0).max(100).optional()),
  itemDiscount: optionalNumber.pipe(z.number().min(0).optional()),
});

export const PurchaseFormSchema = z.object({
  supplierId: z.string().trim().min(1, "Please select a supplier"),
  purchaseCode: z.string().trim().min(1, "Purchase code is required"),
  purchaseDate: requiredDate,
  status: z.string().trim().min(1, "Please select a status"),
  discount: optionalNumber.pipe(z.number().min(0).optional()),
  taxAmount: optionalNumber.pipe(z.number().min(0).optional()),
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
