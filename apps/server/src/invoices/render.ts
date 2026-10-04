import { saleLineTotal } from "@dms/shared";

/** What the template needs; the shape `getSaleByIdOrCode` returns, narrowed. */
export interface InvoiceData {
  organization: { name: string };
  sale: {
    saleCode: string;
    saleDate: Date;
    status: string;
    totalAmount: number;
    discount: number | null;
    taxAmount: number | null;
    customer: { name: string; email: string | null; phone: string | null; address: string | null };
    items: {
      quantity: number;
      unitPrice: number;
      taxPercent: number | null;
      product: { name: string; productCode: string; unit: string };
    }[];
  };
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Every value interpolated below is user-entered -- product names, customer
 * addresses -- and this HTML is opened in the user's browser and rendered by
 * headless Chrome on the server. Unescaped, a product named `<img onerror=...>`
 * runs script in both.
 */
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const date = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" });

/**
 * The default invoice layout, as one self-contained HTML document: inline CSS,
 * no scripts, no external assets. `/print` serves it as-is and `/pdf` prints it
 * through Chrome, so the two cannot drift. Checkpoint 12 swaps in the client's
 * layout behind this same function signature.
 */
export function renderInvoiceHtml({ organization, sale }: InvoiceData): string {
  const subtotal = sale.items.reduce((sum, item) => sum + saleLineTotal(item), 0);
  const rows = sale.items
    .map(
      (item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(item.product.name)}<div class="muted">${escapeHtml(item.product.productCode)}</div></td>
          <td class="num">${item.quantity} ${escapeHtml(item.product.unit)}</td>
          <td class="num">${money.format(item.unitPrice)}</td>
          <td class="num">${item.taxPercent ?? 0}%</td>
          <td class="num">${money.format(saleLineTotal(item))}</td>
        </tr>`
    )
    .join("");

  const customer = sale.customer;
  const contact = [customer.address, customer.phone, customer.email].filter(Boolean).map(escapeHtml);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice ${escapeHtml(sale.saleCode)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; font-size: 13px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; }
  h1 { margin: 0; font-size: 22px; }
  h2 { margin: 0 0 4px; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; }
  .muted { color: #64748b; font-size: 11px; }
  .meta td { padding: 2px 0 2px 16px; text-align: right; }
  section.bill { margin: 24px 0; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { text-align: left; border-bottom: 1px solid #cbd5e1; padding: 8px 6px; font-size: 11px; text-transform: uppercase; color: #475569; }
  table.items td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  table.totals { margin-left: auto; margin-top: 16px; min-width: 260px; }
  table.totals td { padding: 4px 6px; }
  table.totals tr.grand td { border-top: 2px solid #0f172a; font-weight: 700; font-size: 15px; }
  @media print { body { padding: 0; } @page { margin: 16mm; } }
</style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(organization.name)}</h1>
    </div>
    <div>
      <h2>Invoice</h2>
      <table class="meta">
        <tr><td class="muted">Invoice no.</td><td><strong>${escapeHtml(sale.saleCode)}</strong></td></tr>
        <tr><td class="muted">Date</td><td>${date(sale.saleDate)}</td></tr>
        <tr><td class="muted">Status</td><td>${escapeHtml(sale.status)}</td></tr>
      </table>
    </div>
  </header>
  <section class="bill">
    <div class="muted">Bill to</div>
    <div><strong>${escapeHtml(customer.name)}</strong></div>
    ${contact.map((line) => `<div>${line}</div>`).join("")}
  </section>
  <table class="items">
    <thead>
      <tr><th>#</th><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Tax</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="num">${money.format(subtotal)}</td></tr>
    ${sale.discount ? `<tr><td>Discount</td><td class="num">-${money.format(sale.discount)}</td></tr>` : ""}
    ${sale.taxAmount ? `<tr><td>Tax</td><td class="num">${money.format(sale.taxAmount)}</td></tr>` : ""}
    <tr class="grand"><td>Total</td><td class="num">${money.format(sale.totalAmount)}</td></tr>
  </table>
</body>
</html>`;
}
