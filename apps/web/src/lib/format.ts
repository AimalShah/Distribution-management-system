/**
 * Display formatting, kept out of the components so a number reads the same
 * way on every screen and a change to the currency is one edit rather than a
 * sweep through the tree.
 */

/** `Rs 1,500` — PKR carries no practical cents, so CLDR drops the decimals. */
const money = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
});

const wholeMoney = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

/** `Rs 1,500` — line items, invoice totals. */
export function formatMoney(value: number): string {
  return money.format(value);
}

/** `Rs 48,000` — headline totals, where the cents are noise. */
export function formatTotal(value: number): string {
  return wholeMoney.format(value);
}

/** `Jan 5, 2026` — absolute dates in lists and tooltips. */
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** `Jan 5` — axis ticks, where the year repeats thirty times. */
export function formatDay(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
