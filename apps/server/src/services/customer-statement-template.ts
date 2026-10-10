import { escapeHtml } from "./html-utils";

export interface CustomerStatementRenderData {
  company?: {
    name?: string | null;
    address?: string | null;
    gstin?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  customer: {
    id: string;
    customerCode: string;
    name: string;
    phone?: string | null;
    address?: string | null;
    gstin?: string | null;
  };
  from?: string | null;
  to?: string | null;
  openingBalance: number;
  entries: {
    date: string;
    type: "invoice" | "credit" | "payment";
    reference: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    dueDate?: string | null;
  }[];
  totals: {
    invoices: number;
    credits: number;
    payments: number;
    closingBalance: number;
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
 * Renders an A4 monochrome customer statement HTML template (ADR 0002).
 * Designed for crisp, black-and-white office printing with zero color fills.
 */
export function renderCustomerStatementHtml(data: CustomerStatementRenderData): string {
  const companyName = escapeHtml(data.company?.name?.trim() || "Distribution Management System");
  const companyAddress = escapeHtml(data.company?.address?.trim() || "");
  const companyGstin = escapeHtml(data.company?.gstin?.trim() || "");
  const customerName = escapeHtml(data.customer.name);
  const customerCode = escapeHtml(data.customer.customerCode);
  const customerPhone = escapeHtml(data.customer.phone || "");
  const customerAddress = escapeHtml(data.customer.address || "");
  const customerGstin = escapeHtml(data.customer.gstin || "");

  const periodText =
    data.from && data.to
      ? `${formatDate(data.from)} — ${formatDate(data.to)}`
      : data.from
        ? `From ${formatDate(data.from)}`
        : data.to
          ? `Up to ${formatDate(data.to)}`
          : "Complete History";

  const rowsHtml =
    data.entries.length > 0
      ? data.entries
          .map((entry) => {
            const typeLabel =
              entry.type === "invoice"
                ? "INVOICE"
                : entry.type === "credit"
                  ? "CREDIT NOTE"
                  : "PAYMENT";

            return `
              <tr>
                <td style="padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 11px;">
                  ${formatDate(entry.date)}
                </td>
                <td style="padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 11px; font-weight: 500;">
                  ${escapeHtml(entry.reference)}
                </td>
                <td style="padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 11px;">
                  <span style="font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #737373; border-radius: 2px; padding: 1px 4px; margin-right: 4px;">${typeLabel}</span>
                  ${escapeHtml(entry.description)}
                </td>
                <td style="padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 11px;">
                  ${entry.dueDate ? formatDate(entry.dueDate) : "-"}
                </td>
                <td style="padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 11px; text-align: right; font-family: monospace;">
                  ${entry.debit > 0 ? formatMoney(entry.debit) : "-"}
                </td>
                <td style="padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 11px; text-align: right; font-family: monospace;">
                  ${entry.credit > 0 ? formatMoney(entry.credit) : "-"}
                </td>
                <td style="padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 11px; text-align: right; font-weight: 600; font-family: monospace;">
                  ${formatMoney(entry.balance)}
                </td>
              </tr>
            `;
          })
          .join("")
      : `
        <tr>
          <td colspan="7" style="padding: 24px; text-align: center; color: #737373; font-size: 12px; border-bottom: 1px solid #e5e5e5;">
            No transactions found for the selected period.
          </td>
        </tr>
      `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Statement - ${data.customer.name}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #171717;
      background: #ffffff;
      margin: 0;
      padding: 0;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #404040;
      border-bottom: 2px solid #171717;
      padding: 8px 6px;
    }
    .text-right {
      text-align: right;
    }
  </style>
</head>
<body>
  <!-- Document Header -->
  <table style="margin-bottom: 24px;">
    <tr>
      <td style="vertical-align: top; width: 60%;">
        <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">
          ${companyName}
        </div>
        ${companyAddress ? `<div style="font-size: 11px; color: #525252; margin-top: 4px; max-width: 320px;">${companyAddress}</div>` : ""}
        ${companyGstin ? `<div style="font-size: 11px; color: #525252; margin-top: 2px;"><strong>GSTIN:</strong> ${companyGstin}</div>` : ""}
      </td>
      <td style="vertical-align: top; width: 40%; text-align: right;">
        <div style="font-size: 20px; font-weight: 800; letter-spacing: 1px;">
          ACCOUNT STATEMENT
        </div>
        <div style="font-size: 11px; color: #525252; margin-top: 4px;">
          <strong>Date Generated:</strong> ${formatDate(new Date())}
        </div>
        <div style="font-size: 11px; color: #525252; margin-top: 2px;">
          <strong>Period:</strong> ${periodText}
        </div>
      </td>
    </tr>
  </table>

  <!-- Customer & Account Summary Box -->
  <table style="margin-bottom: 24px; border: 1px solid #171717;">
    <tr>
      <td style="width: 55%; padding: 12px 16px; vertical-align: top; border-right: 1px solid #171717;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #525252; margin-bottom: 4px;">
          Account Details
        </div>
        <div style="font-size: 15px; font-weight: 700;">
          ${customerName}
        </div>
        <div style="font-size: 11px; color: #525252; margin-top: 2px;">
          <strong>Customer Code:</strong> ${customerCode}
        </div>
        ${customerPhone ? `<div style="font-size: 11px; color: #525252;"><strong>Phone:</strong> ${customerPhone}</div>` : ""}
        ${customerAddress ? `<div style="font-size: 11px; color: #525252;"><strong>Address:</strong> ${customerAddress}</div>` : ""}
        ${customerGstin ? `<div style="font-size: 11px; color: #525252;"><strong>GSTIN:</strong> ${customerGstin}</div>` : ""}
      </td>
      <td style="width: 45%; padding: 12px 16px; vertical-align: top;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #525252; margin-bottom: 6px;">
          Balance Summary
        </div>
        <table style="font-size: 11px;">
          <tr>
            <td style="padding: 2px 0; color: #525252;">Opening Balance:</td>
            <td style="padding: 2px 0; text-align: right; font-family: monospace;">${formatMoney(data.openingBalance)}</td>
          </tr>
          <tr>
            <td style="padding: 2px 0; color: #525252;">Invoices (Debits):</td>
            <td style="padding: 2px 0; text-align: right; font-family: monospace;">${formatMoney(data.totals.invoices)}</td>
          </tr>
          <tr>
            <td style="padding: 2px 0; color: #525252;">Credits & Returns:</td>
            <td style="padding: 2px 0; text-align: right; font-family: monospace;">${formatMoney(data.totals.credits)}</td>
          </tr>
          <tr>
            <td style="padding: 2px 0; color: #525252;">Payments Received:</td>
            <td style="padding: 2px 0; text-align: right; font-family: monospace;">${formatMoney(data.totals.payments)}</td>
          </tr>
          <tr style="border-top: 1px solid #171717; font-weight: 700;">
            <td style="padding: 6px 0 2px 0; font-size: 12px;">Closing Balance Due:</td>
            <td style="padding: 6px 0 2px 0; text-align: right; font-size: 13px; font-family: monospace;">${formatMoney(data.totals.closingBalance)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Transactions Ledger Table -->
  <table style="margin-bottom: 24px;">
    <thead>
      <tr>
        <th style="text-align: left; width: 12%;">Date</th>
        <th style="text-align: left; width: 14%;">Reference</th>
        <th style="text-align: left; width: 32%;">Description</th>
        <th style="text-align: left; width: 12%;">Due Date</th>
        <th style="text-align: right; width: 10%;">Debit</th>
        <th style="text-align: right; width: 10%;">Credit</th>
        <th style="text-align: right; width: 10%;">Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 11px; font-style: italic;">
          ${data.from ? formatDate(data.from) : "-"}
        </td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 11px; font-style: italic;" colspan="3">
          Opening Balance Brought Forward
        </td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 11px; text-align: right; font-family: monospace;">-</td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 11px; text-align: right; font-family: monospace;">-</td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 11px; text-align: right; font-weight: 600; font-family: monospace;">
          ${formatMoney(data.openingBalance)}
        </td>
      </tr>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr style="border-top: 2px solid #171717; font-weight: 700;">
        <td colspan="4" style="padding: 10px 6px; font-size: 11px; text-transform: uppercase;">Totals</td>
        <td style="padding: 10px 6px; font-size: 11px; text-align: right; font-family: monospace;">${formatMoney(data.totals.invoices)}</td>
        <td style="padding: 10px 6px; font-size: 11px; text-align: right; font-family: monospace;">${formatMoney(data.totals.credits + data.totals.payments)}</td>
        <td style="padding: 10px 6px; font-size: 12px; text-align: right; font-family: monospace; font-weight: 800;">${formatMoney(data.totals.closingBalance)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Signoff & Footer -->
  <div style="margin-top: 36px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div style="font-size: 10px; color: #737373; max-width: 350px;">
      This is a system generated account statement for reconciliation. Please notify us of any discrepancies within 7 days of statement receipt.
    </div>
    <div style="text-align: center; border-top: 1px solid #171717; width: 200px; padding-top: 4px; font-size: 11px; font-weight: 600;">
      Authorized Signatory
    </div>
  </div>
</body>
</html>`;
}
