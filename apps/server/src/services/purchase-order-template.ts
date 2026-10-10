import { escapeHtml } from "./html-utils";

export interface PurchaseOrderRenderData {
  company?: {
    name?: string | null;
    address?: string | null;
    gstin?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  purchase: {
    id: string;
    purchaseCode: string;
    purchaseDate: Date | string;
    status: string;
    totalAmount: number;
    taxAmount?: number | null;
    discount?: number | null;
    supplier: {
      id: string;
      companyName: string;
      contactPerson?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      gstin?: string | null;
    };
    purchaseItems: Array<{
      id: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
      batchNumber?: string | null;
      expiryDate?: Date | string | null;
      taxPercent?: number | null;
      discount?: number | null;
      product: {
        id: string;
        name: string;
        productCode: string;
        unit?: string | null;
      };
    }>;
  };
}

function formatMoney(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(isoOrDate?: string | Date | null): string {
  if (!isoOrDate) return "-";
  try {
    return new Date(isoOrDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(isoOrDate);
  }
}

/**
 * Renders an A4 monochrome Purchase Order / Goods Receipt Note HTML template (ADR 0002).
 * Strictly black-on-white with crisp typographic hierarchy for clean office printing.
 */
export function renderPurchaseOrderHtml(data: PurchaseOrderRenderData): string {
  const { company, purchase } = data;
  const supplier = purchase.supplier;

  const rowsHtml = purchase.purchaseItems
    .map((item, idx) => {
      const gross = item.quantity * item.unitCost;
      const discount = item.discount ?? 0;
      const tax = item.taxPercent ? `${item.taxPercent}%` : "-";
      const prodName = escapeHtml(item.product.name);
      const prodCode = escapeHtml(item.product.productCode);
      const unit = item.product.unit ? ` · ${escapeHtml(item.product.unit)}` : "";
      const batchNumber = item.batchNumber ? escapeHtml(item.batchNumber) : "-";

      return `
        <tr>
          <td class="col-num">${idx + 1}</td>
          <td>
            <div class="product-name">${prodName}</div>
            <div class="product-code">${prodCode}${unit}</div>
          </td>
          <td class="font-mono text-center">${batchNumber}</td>
          <td class="text-center">${formatDate(item.expiryDate)}</td>
          <td class="text-right font-mono">${item.quantity.toLocaleString()}</td>
          <td class="text-right font-mono">${formatMoney(item.unitCost)}</td>
          <td class="text-right font-mono">${discount > 0 ? formatMoney(discount) : "-"}</td>
          <td class="text-right font-mono">${tax}</td>
          <td class="text-right font-mono bold">${formatMoney(item.totalCost || gross)}</td>
        </tr>
      `;
    })
    .join("");

  const subtotal = purchase.purchaseItems.reduce(
    (sum, it) => sum + it.quantity * it.unitCost - (it.discount ?? 0),
    0
  );

  const compName = escapeHtml(company?.name || "DISTRIBUTION MANAGEMENT");
  const compAddress = company?.address ? escapeHtml(company.address) : "";
  const compGstin = company?.gstin ? escapeHtml(company.gstin) : "";
  const compPhone = company?.phone ? escapeHtml(company.phone) : "";

  const suppName = escapeHtml(supplier.companyName);
  const suppContact = supplier.contactPerson ? escapeHtml(supplier.contactPerson) : "";
  const suppAddress = supplier.address ? escapeHtml(supplier.address) : "";
  const suppGstin = supplier.gstin ? escapeHtml(supplier.gstin) : "";
  const suppPhone = supplier.phone ? escapeHtml(supplier.phone) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Purchase Order ${escapeHtml(purchase.purchaseCode)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .container {
      width: 100%;
      max-width: 180mm;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .company-name {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .company-details {
      font-size: 10px;
      color: #333;
      max-width: 95mm;
    }

    .doc-meta {
      text-align: right;
    }

    .doc-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .meta-table {
      margin-left: auto;
      font-size: 10px;
      border-collapse: collapse;
    }

    .meta-table td {
      padding: 1.5px 4px;
    }

    .meta-table td.label {
      color: #555;
      text-align: right;
      text-transform: uppercase;
      font-size: 9px;
      font-weight: 600;
    }

    .meta-table td.val {
      text-align: right;
      font-weight: 700;
    }

    .parties-grid {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
      border: 1px solid #ccc;
      padding: 10px 12px;
    }

    .party-block {
      flex: 1;
    }

    .party-block.left {
      padding-right: 12px;
      border-right: 1px solid #eee;
    }

    .party-block.right {
      padding-left: 12px;
    }

    .section-caption {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #666;
      margin-bottom: 4px;
    }

    .party-name {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 3px;
    }

    .party-text {
      font-size: 10px;
      color: #333;
      line-height: 1.35;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }

    .items-table th {
      background: #f4f4f4;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 6px 4px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .items-table td {
      border-bottom: 1px solid #e0e0e0;
      padding: 6px 4px;
      vertical-align: middle;
      font-size: 10px;
    }

    .items-table tr:last-child td {
      border-bottom: 1px solid #000;
    }

    .col-num {
      width: 20px;
      text-align: center;
      color: #666;
      font-size: 9px;
    }

    .product-name {
      font-weight: 600;
      color: #000;
    }

    .product-code {
      font-size: 9px;
      color: #555;
      font-family: monospace;
      margin-top: 1px;
    }

    .totals-area {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }

    .notes-box {
      max-width: 95mm;
      font-size: 9px;
      color: #555;
      border-left: 2px solid #999;
      padding-left: 8px;
    }

    .totals-table {
      width: 75mm;
      border-collapse: collapse;
      font-size: 10px;
    }

    .totals-table td {
      padding: 3px 6px;
    }

    .totals-table td.lbl {
      color: #444;
      text-align: right;
      text-transform: uppercase;
      font-size: 9px;
      font-weight: 600;
    }

    .totals-table td.val {
      text-align: right;
      font-family: monospace;
      font-size: 11px;
    }

    .totals-table tr.grand-total td {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      font-size: 13px;
      font-weight: 800;
      padding: 6px;
    }

    .sign-section {
      display: flex;
      justify-content: space-between;
      margin-top: 36px;
      padding-top: 12px;
    }

    .sign-box {
      width: 60mm;
      text-align: center;
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #e0e0e0;
      font-size: 8px;
      color: #777;
      display: flex;
      justify-content: space-between;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-mono { font-family: monospace; }
    .bold { font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="company-name">${compName}</div>
        <div class="company-details">
          ${compAddress ? `<div>${compAddress}</div>` : ""}
          ${compGstin ? `<div><strong>GSTIN:</strong> ${compGstin}</div>` : ""}
          ${compPhone ? `<div><strong>Phone:</strong> ${compPhone}</div>` : ""}
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-title">PURCHASE ORDER</div>
        <table class="meta-table">
          <tr>
            <td class="label">PO Number:</td>
            <td class="val font-mono">${escapeHtml(purchase.purchaseCode)}</td>
          </tr>
          <tr>
            <td class="label">PO Date:</td>
            <td class="val">${formatDate(purchase.purchaseDate)}</td>
          </tr>
          <tr>
            <td class="label">Status:</td>
            <td class="val">${escapeHtml(purchase.status)}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="parties-grid">
      <div class="party-block left">
        <div class="section-caption">Vendor / Supplier:</div>
        <div class="party-name">${suppName}</div>
        <div class="party-text">
          ${suppContact ? `<div>Attn: ${suppContact}</div>` : ""}
          ${suppAddress ? `<div>${suppAddress}</div>` : ""}
          ${suppGstin ? `<div>GSTIN: ${suppGstin}</div>` : ""}
          ${suppPhone ? `<div>Tel: ${suppPhone}</div>` : ""}
        </div>
      </div>
      <div class="party-block right">
        <div class="section-caption">Delivery / Bill To:</div>
        <div class="party-name">${compName}</div>
        <div class="party-text">
          ${compAddress ? `<div>${compAddress}</div>` : "<div>Central Distribution Facility</div>"}
          ${compPhone ? `<div>Tel: ${compPhone}</div>` : ""}
          ${compGstin ? `<div>GSTIN: ${compGstin}</div>` : ""}
        </div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="col-num">#</th>
          <th>Item Description</th>
          <th class="text-center">Batch</th>
          <th class="text-center">Expiry</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit Rate</th>
          <th class="text-right">Disc.</th>
          <th class="text-right">Tax</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="totals-area">
      <div class="notes-box">
        <strong>Terms & Conditions:</strong><br />
        1. Goods received are subject to physical inspection and verification against quality standards.<br />
        2. Discrepant or damaged batches will be debited via Return Debit Note.<br />
        3. Payment subject to delivery of tax-compliant original invoices.
      </div>
      <table class="totals-table">
        <tr>
          <td class="lbl">Subtotal:</td>
          <td class="val">${formatMoney(subtotal)}</td>
        </tr>
        ${
          (purchase.discount ?? 0) > 0
            ? `<tr>
                <td class="lbl">Order Discount:</td>
                <td class="val">- ${formatMoney(purchase.discount || 0)}</td>
              </tr>`
            : ""
        }
        ${
          (purchase.taxAmount ?? 0) > 0
            ? `<tr>
                <td class="lbl">Tax Amount:</td>
                <td class="val">${formatMoney(purchase.taxAmount || 0)}</td>
              </tr>`
            : ""
        }
        <tr class="grand-total">
          <td class="lbl">Total Payable:</td>
          <td class="val">${formatMoney(purchase.totalAmount)}</td>
        </tr>
      </table>
    </div>

    <div class="sign-section">
      <div class="sign-box">Prepared By</div>
      <div class="sign-box">Received / Verified By</div>
      <div class="sign-box">Authorized Signatory</div>
    </div>

    <div class="footer">
      <div>Generated via Distribution Management System</div>
      <div>Page 1 of 1</div>
    </div>
  </div>
</body>
</html>`;
}
