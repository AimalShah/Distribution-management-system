import { calculateSaleBreakdown, formatMoney } from "@dms/shared";
import { escapeHtml, renderAutoPrintScript, type DocumentRenderOptions } from "./html-utils";
import type { SaleInvoiceRenderData } from "./sale-invoice-template";

export interface SaleReceiptRenderOptions extends DocumentRenderOptions {
  /** Paper roll width in mm: 80 (standard 3-inch) or 58 (portable 2-inch). Default: 80. */
  width?: "80" | "58" | 80 | 58;
}

/**
 * Compact thermal receipt template optimized for standard 80mm (or 58mm) receipt printers.
 *
 * CRITICAL ANTI-WASTE MEASURES:
 * 1. `@page { size: Xmm auto; margin: 0mm !important; }` strips browser headers/footers
 *    and prevents leading/trailing blank paper feeds.
 * 2. `height: auto !important; min-height: 0 !important;` prevents the browser print
 *    engine from treating the receipt as a 100vh / full-page sheet.
 * 3. Minimal vertical padding (2mm top, 1mm bottom) with all trailing bottom margins
 *    zeroed out on the last element so the printer stops feeding immediately before cutting.
 */
export function renderSaleReceiptHtml(
  sale: SaleInvoiceRenderData,
  options?: SaleReceiptRenderOptions
): string {
  const is58mm = String(options?.width) === "58";
  const paperWidth = is58mm ? "58mm" : "80mm";
  // 58mm paper has ~48mm printable area; 80mm paper has ~72mm printable area.
  const printableWidth = is58mm ? "48mm" : "72mm";

  const formattedDate = new Date(sale.saleDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const formattedTime = new Date(sale.saleDate).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isTaxInvoice = sale.invoiceType === "tax";
  const companyName = escapeHtml(sale.company?.name?.trim() || "AM Enterprise");
  const companyAddress = escapeHtml(sale.company?.address?.trim() || "");
  const companyGstin = escapeHtml(sale.company?.gstin?.trim() || "");

  const customerName = escapeHtml(sale.customer?.name?.trim() || "Cash Customer");
  const customerPhone = escapeHtml(sale.customer?.phone?.trim() || "");
  const createdBy = escapeHtml(sale.createdBy?.name?.trim() || "");

  const items = sale.items || [];

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

  const itemRows = items
    .map((item, idx) => {
      const lineTotal = item.totalPrice ?? item.quantity * item.unitPrice;
      const prodName = escapeHtml(item.product?.name || `Item #${idx + 1}`);

      return `
        <tr>
          <td class="col-item">
            <div class="prod-name">${prodName}</div>
          </td>
          <td class="col-qty text-center">${item.quantity}</td>
          <td class="col-rate text-right">${formatMoney(item.unitPrice)}</td>
          <td class="col-total text-right">${formatMoney(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt ${escapeHtml(sale.saleCode)}</title>
  <style>
    @page {
      size: ${paperWidth} auto;
      margin: 0mm !important;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html, body {
      width: ${paperWidth};
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", Courier, monospace;
      font-size: ${is58mm ? "10px" : "11px"};
      line-height: 1.25;
    }

    .receipt {
      width: ${printableWidth};
      margin: 0 auto;
      padding: 2mm 0 1mm 0;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: 700; }

    .header {
      text-align: center;
      margin-bottom: 4px;
    }
    .company-title {
      font-size: ${is58mm ? "13px" : "15px"};
      font-weight: 800;
      letter-spacing: -0.2px;
      margin-bottom: 2px;
      text-transform: uppercase;
    }
    .company-meta {
      font-size: ${is58mm ? "9px" : "10px"};
      color: #222222;
      line-height: 1.2;
    }

    .dashed {
      border-top: 1px dashed #000000;
      margin: 4px 0;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: ${is58mm ? "9px" : "10px"};
      line-height: 1.3;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: inherit;
    }

    .items-table th {
      border-bottom: 1px dashed #000000;
      padding: 3px 0;
      font-size: ${is58mm ? "9px" : "10px"};
      font-weight: 700;
    }

    .items-table td {
      padding: 2px 0;
      vertical-align: top;
    }

    .col-item {
      width: ${is58mm ? "40%" : "44%"};
      text-align: left;
    }
    .col-qty {
      width: ${is58mm ? "15%" : "14%"};
    }
    .col-rate {
      width: ${is58mm ? "22%" : "21%"};
    }
    .col-total {
      width: ${is58mm ? "23%" : "21%"};
    }

    .prod-name {
      word-break: break-word;
      font-weight: 500;
    }

    .summary-table td {
      padding: 1.5px 0;
    }

    .grand-total {
      font-size: ${is58mm ? "12px" : "13px"};
      font-weight: 800;
      border-top: 1px dashed #000000;
      border-bottom: 1px dashed #000000;
      padding: 3px 0 !important;
    }

    .footer {
      text-align: center;
      margin-top: 4px;
      margin-bottom: 0 !important;
      padding-bottom: 0 !important;
      font-size: ${is58mm ? "9px" : "10px"};
      line-height: 1.25;
    }

    .receipt > *:last-child {
      margin-bottom: 0 !important;
      padding-bottom: 0 !important;
    }

    @media print {
      body {
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="company-title">${companyName}</div>
      ${companyAddress ? `<div class="company-meta">${companyAddress}</div>` : ""}
      ${companyGstin ? `<div class="company-meta">GSTIN: ${companyGstin}</div>` : ""}
      <div class="company-meta bold" style="margin-top: 2px;">${isTaxInvoice ? "TAX INVOICE / RECEIPT" : "RETAIL RECEIPT"}</div>
    </div>

    <div class="dashed"></div>

    <div class="meta-row">
      <span><strong>Rcpt:</strong> ${escapeHtml(sale.saleCode)}</span>
      <span>${formattedDate}</span>
    </div>
    <div class="meta-row">
      <span><strong>Customer:</strong> ${customerName}</span>
      <span>${formattedTime}</span>
    </div>
    ${customerPhone ? `<div class="meta-row"><span><strong>Phone:</strong> ${customerPhone}</span></div>` : ""}
    ${sale.salesman ? `<div class="meta-row"><span><strong>Salesman:</strong> ${escapeHtml(sale.salesman.name)}</span></div>` : (createdBy ? `<div class="meta-row"><span><strong>Cashier:</strong> ${createdBy}</span></div>` : "")}
    ${sale.orderBooker ? `<div class="meta-row"><span><strong>Order Booker:</strong> ${escapeHtml(sale.orderBooker.name)} (${escapeHtml(sale.orderBooker.code)})</span></div>` : ""}
    <div class="meta-row"><span><strong>Tier:</strong> ${escapeHtml((sale.pricingTier || "retail").toUpperCase())}</span></div>

    <div class="dashed"></div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="col-item">ITEM</th>
          <th class="col-qty text-center">QTY</th>
          <th class="col-rate text-right">RATE</th>
          <th class="col-total text-right">AMT</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="dashed"></div>

    <table class="summary-table">
      <tr>
        <td class="text-left">Subtotal:</td>
        <td class="text-right">${formatMoney(money.subtotal)}</td>
      </tr>
      ${money.discount > 0 ? `
      <tr>
        <td class="text-left">Discount:</td>
        <td class="text-right">-${formatMoney(money.discount)}</td>
      </tr>
      ` : ""}
      ${money.taxAmount > 0 ? `
      <tr>
        <td class="text-left">Tax / GST:</td>
        <td class="text-right">${formatMoney(money.taxAmount)}</td>
      </tr>
      ` : ""}
      <tr class="grand-total">
        <td class="text-left bold">TOTAL:</td>
        <td class="text-right bold">${formatMoney(sale.totalAmount)}</td>
      </tr>
    </table>

    <div class="footer">
      <div>Thank you for your purchase!</div>
      <div style="font-size: 8px; margin-top: 2px; color: #555555;">No refund without original receipt</div>
    </div>
  </div>
  ${renderAutoPrintScript(options)}
</body>
</html>`;
}
