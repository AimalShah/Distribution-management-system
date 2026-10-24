import { formatMoney, formatTotal } from "@dms/shared";

/**
 * Display formatting, kept out of the components so a number reads the same
 * way on every screen and a change to the currency is one edit rather than a
 * sweep through the tree.
 */

export { formatMoney, formatTotal };

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
