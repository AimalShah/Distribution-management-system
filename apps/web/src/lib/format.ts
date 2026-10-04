const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number | null | undefined) => currency.format(value ?? 0);

export const formatNumber = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString("en-US");

/**
 * Dates are stored as `timestamp(3)` without a zone and come back as UTC ISO
 * strings, so they are formatted in UTC: the calendar day the user entered is
 * the one they see, whatever the browser's zone.
 */
export const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
