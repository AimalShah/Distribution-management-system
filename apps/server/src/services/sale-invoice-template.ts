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
  customer?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
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

export function renderSaleInvoiceHtml(sale: SaleInvoiceRenderData): string {
  const formattedDate = new Date(sale.saleDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const isTaxInvoice = sale.invoiceType === "tax";
  const customerName = sale.customer?.name || "Cash Customer";
  const customerEmail = sale.customer?.email || "";
  const customerPhone = sale.customer?.phone || "";
  const customerAddress = sale.customer?.address || "";

  const items = sale.items || [];
  const subtotal = items.reduce(
    (sum, it) => sum + it.quantity * it.unitPrice,
    0
  );
  const tax =
    sale.taxAmount ||
    (sale.cgstAmount || 0) + (sale.sgstAmount || 0) + (sale.igstAmount || 0);
  const discount = sale.discount || 0;
  const total = sale.totalAmount;

  const itemRows = items
    .map((item, idx) => {
      const lineTotal = item.totalPrice ?? item.quantity * item.unitPrice;
      const prodName = item.product?.name || `Item #${idx + 1}`;
      const prodCode = item.product?.productCode ? `(${item.product.productCode})` : "";
      const cgst = item.cgstRate ?? 0;
      const sgst = item.sgstRate ?? 0;
      const igst = item.igstRate ?? 0;
      const gstRate = (cgst > 0 || sgst > 0)
        ? (cgst + sgst)
        : (igst || item.taxPercent || item.product?.gstRate || 0);

      return `
        <tr class="border-b border-gray-100">
          <td class="py-3 px-4 text-gray-500 font-mono text-xs">${idx + 1}</td>
          <td class="py-3 px-4">
            <span class="font-medium text-gray-900">${prodName}</span>
            <span class="text-xs text-gray-500 ml-1">${prodCode}</span>
            ${gstRate > 0 ? `<span class="block text-[11px] text-gray-400">GST: ${gstRate}%</span>` : ""}
          </td>
          <td class="py-3 px-4 text-center text-gray-700">${item.quantity}</td>
          <td class="py-3 px-4 text-right text-gray-700">Rs ${item.unitPrice.toFixed(2)}</td>
          <td class="py-3 px-4 text-right font-semibold text-gray-900">Rs ${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isTaxInvoice ? "Tax Invoice" : "Invoice"} ${sale.saleCode}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body class="bg-gray-50 text-gray-800 antialiased font-sans p-6 sm:p-10">
  <div class="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12">
    <!-- Header -->
    <div class="flex justify-between items-start border-b border-gray-200 pb-6 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">${isTaxInvoice ? "Tax Invoice" : "Distribution Management System"}</h1>
        <p class="text-xs text-gray-500 mt-1">${isTaxInvoice ? "Official GST Tax Invoice" : "Inventioo DMS Distribution Network"}</p>
      </div>
      <div class="text-right">
        <span class="inline-block ${isTaxInvoice ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"} text-xs font-semibold px-2.5 py-1 rounded">
          ${isTaxInvoice ? "TAX INVOICE" : sale.status.toUpperCase()}
        </span>
        <h2 class="text-xl font-bold text-gray-900 mt-2 font-mono">${sale.saleCode}</h2>
        <p class="text-xs text-gray-500 mt-1">Date: ${formattedDate}</p>
      </div>
    </div>

    <!-- Bill To -->
    <div class="grid grid-cols-2 gap-8 mb-8">
      <div>
        <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Billed To</h3>
        <p class="text-base font-bold text-gray-900">${customerName}</p>
        ${customerAddress ? `<p class="text-xs text-gray-600 mt-1">${customerAddress}</p>` : ""}
        ${customerPhone ? `<p class="text-xs text-gray-600 mt-0.5">Phone: ${customerPhone}</p>` : ""}
        ${customerEmail ? `<p class="text-xs text-gray-600 mt-0.5">${customerEmail}</p>` : ""}
      </div>
      <div class="text-right">
        <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Invoice Summary</h3>
        <p class="text-xs text-gray-600">Invoice Type: <span class="font-medium text-gray-900">${isTaxInvoice ? "Tax Invoice" : "Regular Invoice"}</span></p>
        <p class="text-xs text-gray-600 mt-1">Total Items: <span class="font-medium text-gray-900">${items.length}</span></p>
        <p class="text-xs text-gray-600 mt-1">Payment Status: <span class="font-medium text-gray-900">${sale.status}</span></p>
      </div>
    </div>

    <!-- Line items table -->
    <div class="overflow-x-auto mb-8">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="bg-gray-50 text-gray-600 text-xs uppercase border-b border-gray-200">
            <th class="py-3 px-4 w-12">#</th>
            <th class="py-3 px-4">Item & Description</th>
            <th class="py-3 px-4 text-center w-20">Qty</th>
            <th class="py-3 px-4 text-right w-28">Unit Price</th>
            <th class="py-3 px-4 text-right w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="flex justify-end mb-8">
      <div class="w-64 space-y-2 text-sm">
        <div class="flex justify-between text-gray-600">
          <span>Subtotal:</span>
          <span class="font-medium text-gray-900">Rs ${subtotal.toFixed(2)}</span>
        </div>
        ${discount > 0 ? `
        <div class="flex justify-between text-green-600">
          <span>Discount:</span>
          <span>-Rs ${discount.toFixed(2)}</span>
        </div>` : ""}
        ${(sale.cgstAmount ?? 0) > 0 ? `
        <div class="flex justify-between text-gray-600">
          <span>CGST:</span>
          <span>Rs ${(sale.cgstAmount ?? 0).toFixed(2)}</span>
        </div>` : ""}
        ${(sale.sgstAmount ?? 0) > 0 ? `
        <div class="flex justify-between text-gray-600">
          <span>SGST:</span>
          <span>Rs ${(sale.sgstAmount ?? 0).toFixed(2)}</span>
        </div>` : ""}
        ${(sale.igstAmount ?? 0) > 0 ? `
        <div class="flex justify-between text-gray-600">
          <span>IGST:</span>
          <span>Rs ${(sale.igstAmount ?? 0).toFixed(2)}</span>
        </div>` : ""}
        ${tax > 0 ? `
        <div class="flex justify-between text-gray-600 font-medium">
          <span>Total Tax:</span>
          <span>+Rs ${tax.toFixed(2)}</span>
        </div>` : ""}
        <div class="border-t border-gray-200 pt-2 flex justify-between text-base font-bold text-gray-900">
          <span>Total:</span>
          <span class="text-blue-600">Rs ${total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
      <p>Thank you for your business. For questions regarding this invoice, please contact support.</p>
    </div>
  </div>

  <div class="text-center mt-6 no-print">
    <button onclick="window.print()" class="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded shadow-sm">
      Print Invoice
    </button>
  </div>
</body>
</html>`;
}
