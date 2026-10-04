/**
 * Document totals, shared by the server that stores them and the forms that
 * preview them. One implementation, so the total a user sees before saving is
 * the total the server writes -- two copies of this arithmetic would drift the
 * first time either changed.
 *
 * Structural parameter types rather than the schema outputs, so a form can
 * pass its in-progress values (with blanks as `undefined`) without first
 * satisfying the whole schema.
 */

export interface PurchaseLine {
  quantity: number;
  unitCost: number;
  taxPercent?: number;
  itemDiscount?: number;
}

/** Gross, less the line discount, plus tax on what remains. */
export const purchaseLineTotal = (item: PurchaseLine): number => {
  const gross = item.quantity * item.unitCost;
  const itemDiscount = item.itemDiscount ?? 0;
  const tax = ((item.taxPercent ?? 0) / 100) * (gross - itemDiscount);
  return gross - itemDiscount + tax;
};

export const calculatePurchaseTotal = (data: {
  items: PurchaseLine[];
  discount?: number;
  taxAmount?: number;
}): number =>
  data.items.reduce((sum, item) => sum + purchaseLineTotal(item), 0) -
  (data.discount ?? 0) +
  (data.taxAmount ?? 0);

export interface SaleLine {
  quantity: number;
  unitPrice: number;
}

/**
 * `sum(quantity * unitPrice) + taxAmount - discount`, as the legacy form did.
 * A line's `taxPercent` is stored but has never been part of the sale total;
 * checkpoint 8 (GST) is where line tax enters the arithmetic.
 */
export const saleLineTotal = (item: SaleLine): number => item.quantity * item.unitPrice;

export const calculateSaleTotal = (data: {
  items: SaleLine[];
  discount?: number;
  taxAmount?: number;
}): number =>
  data.items.reduce((sum, item) => sum + saleLineTotal(item), 0) +
  (data.taxAmount ?? 0) -
  (data.discount ?? 0);
