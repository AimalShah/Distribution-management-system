/** Format PKR amounts consistently in the web UI and generated documents. */
const money = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
});

const wholeMoney = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

export function formatMoney(value: number): string {
  return money.format(value);
}

export function formatTotal(value: number): string {
  return wholeMoney.format(value);
}
