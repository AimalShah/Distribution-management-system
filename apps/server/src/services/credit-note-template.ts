import { escapeHtml } from "./html-utils";

export interface CreditNoteRenderData {
  company?: {
    name?: string | null;
    address?: string | null;
    gstin?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  returnRecord: {
    id: string;
    returnCode: string;
    returnType: string;
    returnDate: Date | string;
    reason?: string | null;
    totalAmount?: number | null;
    sale?: {
      id: string;
      saleCode: string;
      saleDate?: Date | string | null;
      customer?: {
        name?: string | null;
        customerCode?: string | null;
        phone?: string | null;
        address?: string | null;
      } | null;
    } | null;
    purchase?: {
      id: string;
      purchaseCode: string;
      supplier?: {
        companyName?: string | null;
        phone?: string | null;
      } | null;
    } | null;
    user?: {
      name?: string | null;
      email?: string | null;
    } | null;
    items: Array<{
      id: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      batchNumber?: string | null;
      reason?: string | null;
      product: {
        id: string;
        name: string;
        productCode: string;
        unit?: string | null;
      };
    }>;
  };
}

function formatMoney(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "Rs. 0.00";
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
 * Renders an A4 monochrome Return Note / Credit Note (ADR 0002).
 * Strictly black-on-white with crisp typographic hierarchy for clean office printing.
 */
export function renderCreditNoteHtml(data: CreditNoteRenderData): string {
  const { company, returnRecord } = data;
  const isSaleReturn = returnRecord.returnType === "SALE";
  const title = isSaleReturn ? "CREDIT NOTE (SALE RETURN)" : "DEBIT NOTE (PURCHASE RETURN)";

  const compName = escapeHtml(company?.name || "DISTRIBUTION MANAGEMENT");
  const compAddress = company?.address ? escapeHtml(company.address) : "";
  const compGstin = company?.gstin ? escapeHtml(company.gstin) : "";

  const partyName = escapeHtml(
    isSaleReturn
      ? returnRecord.sale?.customer?.name || "Customer"
      : returnRecord.purchase?.supplier?.companyName || "Supplier"
  );

  const partyCode = escapeHtml(
    isSaleReturn ? returnRecord.sale?.customer?.customerCode || "" : ""
  );

  const partyPhone = escapeHtml(
    isSaleReturn
      ? returnRecord.sale?.customer?.phone || ""
      : returnRecord.purchase?.supplier?.phone || ""
  );

  const linkedDoc = escapeHtml(
    isSaleReturn
      ? `Original Invoice: ${returnRecord.sale?.saleCode || "-"}`
      : `Original PO: ${returnRecord.purchase?.purchaseCode || "-"}`
  );

  const returnReason = returnRecord.reason ? escapeHtml(returnRecord.reason) : "";

  const rowsHtml = (returnRecord.items || [])
    .map((item, idx) => {
      const lineTotal = item.totalPrice ?? (item.quantity * item.unitPrice);
      const prodName = escapeHtml(item.product?.name || "Product");
      const prodCode = item.product?.productCode ? ` · ${escapeHtml(item.product.productCode)}` : "";
      const unit = item.product?.unit ? ` · ${escapeHtml(item.product.unit)}` : "";
      const batchNumber = item.batchNumber ? escapeHtml(item.batchNumber) : "-";
      const lineReason = item.reason ? escapeHtml(item.reason) : "-";

      return `
      <tr>
        <td class="col-num">${idx + 1}</td>
        <td>
          <div class="product-name">${prodName}</div>
          <div class="product-code">${prodCode}${unit}</div>
        </td>
        <td class="font-mono text-center">${batchNumber}</td>
        <td class="text-center">${lineReason}</td>
        <td class="text-right font-mono">${(item.quantity || 0).toLocaleString()}</td>
        <td class="text-right font-mono">${formatMoney(item.unitPrice)}</td>
        <td class="text-right font-mono bold">${formatMoney(lineTotal)}</td>
      </tr>
    `;
    })
    .join("");

  const grandTotal =
    returnRecord.totalAmount ??
    (returnRecord.items || []).reduce((sum, it) => sum + (it.totalPrice ?? (it.quantity * it.unitPrice)), 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title} ${returnRecord.returnCode}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
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
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.04em;
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
      padding: 4px 6px;
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
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-title">${title}</div>
        <table class="meta-table">
          <tr>
            <td class="label">Note Code:</td>
            <td class="val font-mono">${escapeHtml(returnRecord.returnCode)}</td>
          </tr>
          <tr>
            <td class="label">Date:</td>
            <td class="val">${formatDate(returnRecord.returnDate)}</td>
          </tr>
          <tr>
            <td class="label">Reference:</td>
            <td class="val font-mono">${linkedDoc}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="parties-grid">
      <div class="party-block">
        <div class="section-caption">${isSaleReturn ? "Issued To Customer:" : "Debited To Vendor:"}</div>
        <div class="party-name">${partyName} ${partyCode ? `(${partyCode})` : ""}</div>
        <div class="party-text">
          ${partyPhone ? `<div>Tel: ${partyPhone}</div>` : ""}
          ${returnReason ? `<div>Return Reason: ${returnReason}</div>` : ""}
        </div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="col-num">#</th>
          <th>Returned Product</th>
          <th class="text-center">Batch</th>
          <th class="text-center">Line Reason</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit Rate</th>
          <th class="text-right">Credit Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="totals-area">
      <div class="notes-box">
        <strong>Notes:</strong><br />
        This document serves as an official accounting adjustment.<br />
        Ledger accounts have been credited/debited accordingly.
      </div>
      <table class="totals-table">
        <tr class="grand-total">
          <td class="lbl">Net Adjusted Value:</td>
          <td class="val font-mono">${formatMoney(grandTotal)}</td>
        </tr>
      </table>
    </div>

    <div class="sign-section">
      <div class="sign-box">Prepared By</div>
      <div class="sign-box">Inspected / Warehouse Stamp</div>
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
