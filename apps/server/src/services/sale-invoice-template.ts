import { calculateSaleBreakdown } from "@dms/shared";
import { escapeHtml } from "./html-utils";

export interface SaleInvoiceRenderData {
  saleCode: string;
  saleDate: Date | string;
  status: string;
  totalAmount: number;
  taxAmount?: number | null;
  discount?: number | null;
  invoiceType?: string | null;
  isInterState?: boolean | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  /** The date this credit sale's balance is payable (ADR 0009); null on a cash sale. */
  dueDate?: Date | string | null;
  customer?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  /** The Company's own profile, printed as the document issuer (issue #39). */
  company?: {
    name?: string | null;
    address?: string | null;
    gstin?: string | null;
  } | null;
  items?: {
    quantity: number;
    unitPrice: number;
    totalPrice?: number;
    taxPercent?: number | null;
    cgstRate?: number | null;
    sgstRate?: number | null;
    igstRate?: number | null;
    cgstAmount?: number | null;
    sgstAmount?: number | null;
    igstAmount?: number | null;
    product?: {
      name: string;
      productCode?: string;
      gstApplicable?: boolean | null;
      gstRate?: number | null;
    } | null;
  }[];
}

/**
 * The invoice document (ADR 0002). Monochrome black-on-white with restrained
 * grey rules and no coloured chips or fills, per the client requirement: it has
 * to print legibly on a plain office printer, where a coloured fill is a grey
 * smear. Money renders as `Rs` everywhere.
 */
export function renderSaleInvoiceHtml(sale: SaleInvoiceRenderData): string {
  const formattedDate = new Date(sale.saleDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const formattedDueDate = sale.dueDate
    ? new Date(sale.dueDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const isTaxInvoice = sale.invoiceType === "tax";
  const customerName = escapeHtml(sale.customer?.name || "Cash Customer");
  const customerEmail = escapeHtml(sale.customer?.email || "");
  const customerPhone = escapeHtml(sale.customer?.phone || "");
  const customerAddress = escapeHtml(sale.customer?.address || "");

  const companyName = escapeHtml(sale.company?.name?.trim() || "Distribution Management System");
  const companyAddress = escapeHtml(sale.company?.address?.trim() || "");
  const companyGstin = escapeHtml(sale.company?.gstin?.trim() || "");

  const items = sale.items || [];

  // The totals block prints the same module the write path called, fed with
  // what is stored on the document: line subtotals and splits pass through
  // untouched, and the header's own figures win — nothing here re-derives
  // arithmetic of its own.
  const money = calculateSaleBreakdown({
    items: items.map((it) => ({
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      subtotal: it.totalPrice ?? it.quantity * it.unitPrice,
      cgstRate: it.cgstRate ?? 0,
      sgstRate: it.sgstRate ?? 0,
      igstRate: it.igstRate ?? 0,
      cgstAmount: it.cgstAmount ?? 0,
      sgstAmount: it.sgstAmount ?? 0,
      igstAmount: it.igstAmount ?? 0,
    })),
    discount: sale.discount ?? undefined,
    taxAmount: sale.taxAmount ?? undefined,
    cgstAmount: sale.cgstAmount ?? undefined,
    sgstAmount: sale.sgstAmount ?? undefined,
    igstAmount: sale.igstAmount ?? undefined,
  });

  const subtotal = money.subtotal;
  const tax = money.taxAmount;
  const discount = money.discount;
  const total = sale.totalAmount;

  const itemRows = items
    .map((item, idx) => {
      const lineTotal = item.totalPrice ?? item.quantity * item.unitPrice;
      const prodName = escapeHtml(item.product?.name || `Item #${idx + 1}`);
      const prodCode = item.product?.productCode ? `(${escapeHtml(item.product.productCode)})` : "";
      const cgst = item.cgstRate ?? 0;
      const sgst = item.sgstRate ?? 0;
      const igst = item.igstRate ?? 0;

      const gstRate = cgst > 0 || sgst > 0
        ? cgst + sgst
        : igst || item.taxPercent || item.product?.gstRate || 0;

      return `
        <tr>
          <td class="num">${idx + 1}</td>
          <td>
            <span class="item-name">${prodName}</span>
            ${prodCode ? `<span class="item-code">${prodCode}</span>` : ""}
            ${gstRate > 0 ? `<span class="item-gst">GST: ${gstRate}%</span>` : ""}
          </td>
          <td class="num">${item.quantity}</td>
          <td class="num">Rs ${item.unitPrice.toFixed(2)}</td>
          <td class="num strong">Rs ${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isTaxInvoice ? "Tax Invoice" : "Invoice"} ${escapeHtml(sale.saleCode)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 24px;
      background: #ffffff;
      color: #111111;
      font-family: "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.45;
    }
    .sheet { max-width: 780px; margin: 0 auto; }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      border-bottom: 2px solid #111111;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .issuer-name { font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
    .issuer-line { margin: 2px 0 0; color: #444444; font-size: 12px; }
    .doc-meta { text-align: right; }
    .doc-type {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      border-bottom: 1px solid #111111;
      padding-bottom: 2px;
    }
    .doc-code { font-size: 18px; font-weight: 700; margin: 8px 0 0; font-family: "SFMono-Regular", Menlo, monospace; }
    .doc-date { margin: 2px 0 0; color: #444444; font-size: 12px; }
    .parties { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 24px; }
    .label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #666666;
      margin: 0 0 6px;
    }
    .party-name { font-size: 15px; font-weight: 700; margin: 0; }
    .party-line { margin: 2px 0 0; color: #333333; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th {
      text-align: left;
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #333333;
      border-top: 1px solid #111111;
      border-bottom: 1px solid #111111;
      padding: 8px 8px;
    }
    tbody td { border-bottom: 1px solid #dddddd; padding: 9px 8px; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .strong { font-weight: 700; }
    .item-name { font-weight: 600; }
    .item-code { color: #666666; font-size: 11px; margin-left: 4px; }
    .item-gst { display: block; color: #777777; font-size: 11px; }
    .totals { display: flex; justify-content: flex-end; }
    .totals-table { width: 280px; border-collapse: collapse; }
    .totals-table td { padding: 4px 0; }
    .totals-table .gline td { border-top: 1px solid #111111; padding-top: 8px; font-size: 15px; font-weight: 700; }
    .totals-table .lbl { color: #444444; }
    .totals-table .amt { text-align: right; }
    .footer {
      border-top: 1px solid #dddddd;
      margin-top: 28px;
      padding-top: 12px;
      text-align: center;
      color: #888888;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="doc-header">
      <div>
        <h1 class="issuer-name">${companyName}</h1>
        ${companyAddress ? `<p class="issuer-line">${companyAddress}</p>` : ""}
        ${companyGstin ? `<p class="issuer-line">GSTIN: ${companyGstin}</p>` : ""}
      </div>
      <div class="doc-meta">
        <div class="doc-type">${isTaxInvoice ? "Tax Invoice" : "Invoice"}</div>
        <h2 class="doc-code">${sale.saleCode}</h2>
        <p class="doc-date">Date: ${formattedDate}</p>
        ${formattedDueDate ? `<p class="doc-date">Due: ${formattedDueDate}</p>` : ""}
        <p class="doc-date">Status: ${sale.status}</p>
      </div>
    </div>

    <div class="parties">
      <div>
        <p class="label">Billed To</p>
        <p class="party-name">${customerName}</p>
        ${customerAddress ? `<p class="party-line">${customerAddress}</p>` : ""}
        ${customerPhone ? `<p class="party-line">Phone: ${customerPhone}</p>` : ""}
        ${customerEmail ? `<p class="party-line">${customerEmail}</p>` : ""}
      </div>
      <div>
        <p class="label">Summary</p>
        <p class="party-line">Invoice Type: ${isTaxInvoice ? "Tax Invoice" : "Regular Invoice"}</p>
        <p class="party-line">Total Items: ${items.length}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 36px">#</th>
          <th>Item &amp; Description</th>
          <th class="num" style="width: 64px">Qty</th>
          <th class="num" style="width: 110px">Unit Price</th>
          <th class="num" style="width: 110px">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="totals">
      <table class="totals-table">
        <tr>
          <td class="lbl">Subtotal</td>
          <td class="amt">Rs ${subtotal.toFixed(2)}</td>
        </tr>
        ${discount > 0 ? `
        <tr>
          <td class="lbl">Discount</td>
          <td class="amt">-Rs ${discount.toFixed(2)}</td>
        </tr>` : ""}
        ${(sale.cgstAmount ?? 0) > 0 ? `
        <tr>
          <td class="lbl">CGST</td>
          <td class="amt">Rs ${(sale.cgstAmount ?? 0).toFixed(2)}</td>
        </tr>` : ""}
        ${(sale.sgstAmount ?? 0) > 0 ? `
        <tr>
          <td class="lbl">SGST</td>
          <td class="amt">Rs ${(sale.sgstAmount ?? 0).toFixed(2)}</td>
        </tr>` : ""}
        ${(sale.igstAmount ?? 0) > 0 ? `
        <tr>
          <td class="lbl">IGST</td>
          <td class="amt">Rs ${(sale.igstAmount ?? 0).toFixed(2)}</td>
        </tr>` : ""}
        ${tax > 0 ? `
        <tr>
          <td class="lbl">Total Tax</td>
          <td class="amt">Rs ${tax.toFixed(2)}</td>
        </tr>` : ""}
        <tr class="gline">
          <td>Total</td>
          <td class="amt">Rs ${total.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <p>Thank you for your business. For questions regarding this invoice, please contact us.</p>
    </div>
  </div>
</body>
</html>`;
}
