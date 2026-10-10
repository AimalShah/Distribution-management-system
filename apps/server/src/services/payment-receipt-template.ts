import { escapeHtml } from "./html-utils";

export interface PaymentReceiptRenderData {
  company?: {
    name?: string | null;
    address?: string | null;
    gstin?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  payment: {
    id: string;
    amount: number;
    method?: string;
    paymentMethod?: string;
    reference?: string | null;
    note?: string | null;
    notes?: string | null;
    paidAt: Date | string;
    customer?: {
      id: string;
      customerCode: string;
      name: string;
      phone?: string | null;
      address?: string | null;
    } | null;
    sale?: {
      id: string;
      saleCode: string;
      totalAmount: number;
      amountPaid?: number | null;
      status: string;
    } | null;
    user?: {
      name?: string | null;
      email?: string | null;
    } | null;
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
 * Renders an A4 monochrome Payment Collection Receipt (ADR 0002).
 * Strictly black-on-white with crisp typographic hierarchy for clean office printing.
 */
export function renderPaymentReceiptHtml(data: PaymentReceiptRenderData): string {
  const { company, payment } = data;
  const customer = payment.customer;
  const sale = payment.sale;

  const compName = escapeHtml(company?.name || "DISTRIBUTION MANAGEMENT");
  const compAddress = company?.address ? escapeHtml(company.address) : "";
  const compGstin = company?.gstin ? escapeHtml(company.gstin) : "";
  const compPhone = company?.phone ? escapeHtml(company.phone) : "";

  const custName = customer ? escapeHtml(customer.name) : "Walk-in Customer";
  const custCode = customer?.customerCode ? escapeHtml(customer.customerCode) : "";
  const custPhone = customer?.phone ? escapeHtml(customer.phone) : "";
  const saleCode = sale?.saleCode ? escapeHtml(sale.saleCode) : "";
  const paymentRef = payment.reference ? escapeHtml(payment.reference) : "";
  const paymentNote = payment.notes || payment.note ? escapeHtml(payment.notes || payment.note) : "";
  const operator = escapeHtml(payment.user?.name || payment.user?.email || "System Operator");
  const payMethod = escapeHtml((payment.method || payment.paymentMethod || "CASH").toUpperCase());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Payment Receipt #${escapeHtml(payment.id.slice(-6).toUpperCase())}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 20mm;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .container {
      width: 100%;
      max-width: 170mm;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000;
      padding-bottom: 14px;
      margin-bottom: 20px;
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
      padding: 2px 4px;
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

    .receipt-box {
      border: 1px solid #000;
      padding: 16px;
      margin-bottom: 24px;
    }

    .amount-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f4f4f4;
      border: 1px solid #ccc;
      padding: 12px 16px;
      margin-bottom: 16px;
    }

    .amount-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .amount-value {
      font-size: 22px;
      font-weight: 800;
      font-family: monospace;
    }

    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }

    .details-table td {
      padding: 6px 4px;
      border-bottom: 1px solid #eee;
      font-size: 11px;
    }

    .details-table td.lbl {
      width: 35%;
      color: #555;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 9px;
    }

    .details-table td.val {
      font-weight: 600;
    }

    .sign-section {
      display: flex;
      justify-content: space-between;
      margin-top: 48px;
      padding-top: 12px;
    }

    .sign-box {
      width: 65mm;
      text-align: center;
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .footer {
      margin-top: 36px;
      padding-top: 8px;
      border-top: 1px solid #e0e0e0;
      font-size: 8px;
      color: #777;
      display: flex;
      justify-content: space-between;
    }

    .font-mono { font-family: monospace; }
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
        <div class="doc-title">OFFICIAL RECEIPT</div>
        <table class="meta-table">
          <tr>
            <td class="label">Receipt ID:</td>
            <td class="val font-mono">REC-${escapeHtml(payment.id.slice(-8).toUpperCase())}</td>
          </tr>
          <tr>
            <td class="label">Payment Date:</td>
            <td class="val">${formatDate(payment.paidAt)}</td>
          </tr>
          <tr>
            <td class="label">Payment Mode:</td>
            <td class="val">${payMethod}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="amount-banner">
      <div class="amount-label">Amount Received In Full:</div>
      <div class="amount-value">${formatMoney(payment.amount)}</div>
    </div>

    <div class="receipt-box">
      <table class="details-table">
        <tr>
          <td class="lbl">Received From:</td>
          <td class="val">
            ${custName}${custCode ? ` (${custCode})` : ""}
          </td>
        </tr>
        ${
          custPhone
            ? `<tr>
                <td class="lbl">Customer Contact:</td>
                <td class="val">${custPhone}</td>
              </tr>`
            : ""
        }
        ${
          sale
            ? `<tr>
                <td class="lbl">Applied To Invoice:</td>
                <td class="val font-mono">
                  ${saleCode} (Invoice Total: ${formatMoney(sale.totalAmount)})
                </td>
              </tr>`
            : ""
        }
        <tr>
          <td class="lbl">Payment Method:</td>
          <td class="val">${payMethod}</td>
        </tr>
        ${
          paymentRef
            ? `<tr>
                <td class="lbl">Transaction / Cheque Ref:</td>
                <td class="val font-mono">${paymentRef}</td>
              </tr>`
            : ""
        }
        ${
          paymentNote
            ? `<tr>
                <td class="lbl">Remarks / Notes:</td>
                <td class="val">${paymentNote}</td>
              </tr>`
            : ""
        }
        <tr>
          <td class="lbl">Collected / Recorded By:</td>
          <td class="val">${operator}</td>
        </tr>
      </table>
    </div>

    <div class="sign-section">
      <div class="sign-box">Customer Signature / Stamp</div>
      <div class="sign-box">Authorized Collector / Cashier</div>
    </div>

    <div class="footer">
      <div>This is a computer generated official acknowledgement of payment.</div>
      <div>Page 1 of 1</div>
    </div>
  </div>
</body>
</html>`;
}
