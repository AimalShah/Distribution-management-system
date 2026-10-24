/**
 * The money figures of a sale document: subtotal, the CGST/SGST/IGST split,
 * the discount, the tax and the total.
 *
 * This is the one module that owns those figures. The write path
 * (`createSale`), the read paths (`getSaleInvoiceData` and the HTML invoice
 * template) and `SaleInvoiceForm` in the browser all derive their numbers by
 * calling `calculateSaleBreakdown`, so a total previewed in the browser is the
 * total the server writes — same rates, same rounding, same invalid-total
 * rule — without any of them holding a copy of the arithmetic.
 *
 * The rules, in one place:
 *
 * - A line's subtotal is `subtotal` when the caller supplies one, otherwise
 *   `quantity * unitPrice`.
 * - A line's effective GST rate is `taxPercent ?? gstRate ?? 0`, and only while
 *   `gstApplicable` (default `true`) says the line is taxable.
 * - Intra-state (`isInterState` unset or `false`) splits that rate evenly:
 *   CGST and SGST each carry `rate / 2` rounded to two decimals. Inter-state
 *   puts the whole rate on IGST. Every per-line amount is rounded to two
 *   decimals, and the sums are rounded again before they are reported.
 * - A line that arrives with its own rates or amounts (a stored document being
 *   read back) is taken as given; the split is only derived when the line has
 *   nothing yet.
 * - The document may carry its own split or tax (`cgstAmount`, `sgstAmount`,
 *   `igstAmount`, `taxAmount`); a supplied figure wins over the derived one.
 * - `taxAmount` is the supplied override when there is one, otherwise the
 *   rounded sum of the three GST components.
 * - The total is `round(subtotal + taxAmount - discount)`, and a total below
 *   zero is refused through `isInvalidSaleTotal` by whichever side owns the
 *   write — never clamped away.
 */

/** One line of the document, as the caller knows it: inputs only, no figures. */
type MoneyInput = number | string | { toString(): string };

export interface SaleBreakdownLineInput {
  productId?: string;
  quantity: number;
  unitPrice: MoneyInput;
  /** Line subtotal override; absent means `quantity * unitPrice`. */
  subtotal?: MoneyInput;
  gstApplicable?: boolean;
  /** Product GST rate in percent, the fallback when the line states no rate. */
  gstRate?: number;
  /** Line GST rate in percent; wins over `gstRate` when present. */
  taxPercent?: number;
  /** A stored line may arrive with its split already resolved. */
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cgstAmount?: MoneyInput;
  sgstAmount?: MoneyInput;
  igstAmount?: MoneyInput;
  productName?: string;
  productCode?: string;
}

/** The document-level inputs: the lines plus the header's own figures. */
export interface SaleBreakdownParams {
  items: SaleBreakdownLineInput[];
  isInterState?: boolean;
  discount?: MoneyInput;
  /** Header tax; supplied, it wins over the derived GST sum. */
  taxAmount?: MoneyInput;
  /** Header split; each supplied component wins over its derived sum. */
  cgstAmount?: MoneyInput;
  sgstAmount?: MoneyInput;
  igstAmount?: MoneyInput;
}

/** One line after the module has resolved its rate, split and amount. */
export interface SaleBreakdownItem {
  productId?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  productName?: string;
  productCode?: string;
  gstApplicable?: boolean;
  gstRate?: number;
  /** The rate actually applied to the line (`0` when the line is not taxed). */
  taxPercent: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

/** The document's money figures, ready for the columns that store them. */
export interface SaleBreakdownResult {
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  discount: number;
  total: number;
  items: SaleBreakdownItem[];
}

import { fromPaise, percentagePaise, toPaise } from "./money";

const roundRate = (value: number) => Number(value.toFixed(2));

/**
 * The single implementation of a sale document's money figures — see the note
 * at the top of this module for the rules it applies.
 */
export function calculateSaleBreakdown(params: SaleBreakdownParams): SaleBreakdownResult {
  const isInterState = Boolean(params.isInterState);
  let totalCgst = 0n;
  let totalSgst = 0n;
  let totalIgst = 0n;
  let subtotal = 0n;

  const items: SaleBreakdownItem[] = params.items.map((item) => {
    const unitPricePaise = toPaise(item.unitPrice);
    const lineTotalPaise = item.subtotal === undefined
      ? BigInt(item.quantity) * unitPricePaise
      : toPaise(item.subtotal);
    const lineTotal = fromPaise(lineTotalPaise);
    const unitPrice = fromPaise(unitPricePaise);
    subtotal += lineTotalPaise;
    const isGstApplicable = item.gstApplicable ?? true;
    const rawRate = isGstApplicable ? (item.taxPercent ?? item.gstRate ?? 0) : 0;

    let cgstRate = item.cgstRate ?? 0;
    let sgstRate = item.sgstRate ?? 0;
    let igstRate = item.igstRate ?? 0;
    let cgstAmount = fromPaise(toPaise(item.cgstAmount ?? 0));
    let sgstAmount = fromPaise(toPaise(item.sgstAmount ?? 0));
    let igstAmount = fromPaise(toPaise(item.igstAmount ?? 0));

    if (rawRate > 0 && !item.cgstRate && !item.sgstRate && !item.igstRate && !item.cgstAmount && !item.sgstAmount && !item.igstAmount) {
      if (isInterState) {
        igstRate = rawRate;
        igstAmount = fromPaise(percentagePaise(lineTotalPaise, igstRate));
      } else {
        cgstRate = roundRate(rawRate / 2);
        sgstRate = roundRate(rawRate / 2);
        cgstAmount = fromPaise(percentagePaise(lineTotalPaise, cgstRate));
        sgstAmount = fromPaise(percentagePaise(lineTotalPaise, sgstRate));
      }
    }

    const cgstAmountPaise = toPaise(cgstAmount);
    const sgstAmountPaise = toPaise(sgstAmount);
    const igstAmountPaise = toPaise(igstAmount);
    totalCgst += cgstAmountPaise;
    totalSgst += sgstAmountPaise;
    totalIgst += igstAmountPaise;

    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      subtotal: lineTotal,
      productName: item.productName,
      productCode: item.productCode,
      gstApplicable: item.gstApplicable,
      gstRate: item.gstRate,
      taxPercent: rawRate,
      cgstRate,
      sgstRate,
      igstRate,
      cgstAmount,
      sgstAmount,
      igstAmount,
    };
  });

  const cgstAmount = fromPaise(params.cgstAmount === undefined ? totalCgst : toPaise(params.cgstAmount));
  const sgstAmount = fromPaise(params.sgstAmount === undefined ? totalSgst : toPaise(params.sgstAmount));
  const igstAmount = fromPaise(params.igstAmount === undefined ? totalIgst : toPaise(params.igstAmount));

  const taxAmountPaise = params.taxAmount !== undefined
    ? toPaise(params.taxAmount)
    : toPaise(cgstAmount) + toPaise(sgstAmount) + toPaise(igstAmount);
  const taxAmount = fromPaise(taxAmountPaise);

  const discountPaise = toPaise(params.discount ?? 0);
  const discount = fromPaise(discountPaise);
  const total = fromPaise(subtotal + taxAmountPaise - discountPaise);

  return {
    subtotal: fromPaise(subtotal),
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    discount,
    total,
    items,
  };
}

/**
 * The one invalid-total rule, shared by both sides of the write: a sale
 * document may never total less than zero. The server refuses the document
 * with `INVALID_TOTAL`; the form shows the same condition instead of quietly
 * clamping the arithmetic into something the server would reject.
 */
export function isInvalidSaleTotal(total: number): boolean {
  return total < 0;
}
