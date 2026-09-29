type SaleInvoiceSkeleton = {
  saleCode: string;
  saleDate: Date | string;
  customer?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  items?: {
    product?: { name: string; description?: string | null } | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  paymentStatus?: string;
  paymentMethod?: string;
  notes?: string;
  discount?: number | null;
  taxAmount?: number | null;
  totalAmount: number;
  subtotal?: number;
};

type SaleInvoiceItem = {
  product?: { name: string; description?: string | null } | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export function saleInvoiceSkeleton(saleInvoice: SaleInvoiceSkeleton): string {
  const formattedDate = new Date(saleInvoice.saleDate).toLocaleDateString()
  const customer = saleInvoice.customer ?? { name: "N/A", email: null, phone: null, address: null }
  const items: SaleInvoiceItem[] = saleInvoice.items ?? []

  function calculateSubtotal(items: SaleInvoiceItem[]): number {
    return items.reduce((sum, item) => sum + (item?.totalPrice || 0), 0)
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${saleInvoice.saleCode}</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="font-sans leading-relaxed text-black bg-white text-sm">
      <div class="max-w-2xl mx-auto p-6">
        <!-- Converted header to Tailwind classes -->
        <div class="flex justify-between items-start mb-8">
          <div class="company-info">
            <h1 class="text-xl font-semibold mb-0.5">Your Company</h1>
            <p class="text-gray-600 text-xs">Invoice Solutions</p>
          </div>
          <div class="text-right">
            <h2 class="text-lg font-semibold mb-1.5">Invoice</h2>
            <p class="mb-0.5 text-gray-600 text-xs">#${saleInvoice.saleCode}</p>
            <p class="text-gray-600 text-xs">${formattedDate}</p>
          </div>
        </div>
        
        <!-- Converted details section to Tailwind grid -->
        <div class="grid grid-cols-2 gap-6 mb-8">
          <div>
            <h3 class="text-xs font-semibold mb-2 uppercase tracking-wider">Bill To</h3>
            <p class="mb-0.5 text-gray-900 text-xs"><strong>${customer.name || "N/A"}</strong></p>
            ${customer.email ? `<p class="mb-0.5 text-gray-900 text-xs">${customer.email}</p>` : ""}
            ${customer.phone ? `<p class="mb-0.5 text-gray-900 text-xs">${customer.phone}</p>` : ""}
            ${customer.address ? `<p class="mb-0.5 text-gray-900 text-xs">${customer.address}</p>` : ""}
          </div>
          
          <div>
            <h3 class="text-xs font-semibold mb-2 uppercase tracking-wider">Details</h3>
            <p class="mb-0.5 text-gray-900 text-xs"><strong>Status:</strong> ${saleInvoice.paymentStatus || "Pending"}</p>
            <p class="mb-0.5 text-gray-900 text-xs"><strong>Method:</strong> ${saleInvoice.paymentMethod || "N/A"}</p>
            ${saleInvoice.notes ? `<p class="mb-0.5 text-gray-900 text-xs"><strong>Notes:</strong> ${saleInvoice.notes}</p>` : ""}
          </div>
        </div>
        
        <!-- Converted table to Tailwind classes -->
        <table class="w-full border-collapse mb-6">
          <thead>
            <tr>
              <th class="border-b border-black py-2 text-left font-semibold text-xs">Description</th>
              <th class="border-b border-black py-2 text-center font-semibold text-xs">Qty</th>
              <th class="border-b border-black py-2 text-right font-semibold text-xs">Price</th>
              <th class="border-b border-black py-2 text-right font-semibold text-xs">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item: SaleInvoiceItem) => `
              <tr>
                <td class="py-3 border-b border-gray-200 text-xs last:border-b-0">
                  ${item?.product?.name || "N/A"}
                  ${item?.product?.description ? `<br><span class="text-gray-600 text-xs">${item.product.description}</span>` : ""}
                </td>
                <td class="py-3 border-b border-gray-200 text-center text-xs last:border-b-0">${item?.quantity || 0}</td>
                <td class="py-3 border-b border-gray-200 text-right text-xs last:border-b-0">$${(item?.unitPrice || 0).toFixed(2)}</td>
                <td class="py-3 border-b border-gray-200 text-right text-xs last:border-b-0">$${(item?.totalPrice || 0).toFixed(2)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
        
        <!-- Converted summary section to Tailwind flexbox -->
        <div class="flex justify-end mt-6">
          <table class="min-w-48">
            <tr>
              <td class="py-1.5 text-right pr-4 text-xs">Subtotal</td>
              <td class="py-1.5 text-right text-xs">$${(saleInvoice.subtotal || calculateSubtotal(items)).toFixed(2)}</td>
            </tr>
            ${
              (saleInvoice.discount ?? 0) > 0
                ? `
              <tr>
                <td class="py-1.5 text-right pr-4 text-xs">Discount</td>
                <td class="py-1.5 text-right text-xs">-$${(saleInvoice.discount ?? 0).toFixed(2)}</td>
              </tr>
            `
                : ""
            }
            ${
              (saleInvoice.taxAmount ?? 0) > 0
                ? `
              <tr>
                <td class="py-1.5 text-right pr-4 text-xs">Tax</td>
                <td class="py-1.5 text-right text-xs">$${(saleInvoice.taxAmount ?? 0).toFixed(2)}</td>
              </tr>
            `
                : ""
            }
            <tr>
              <td class="pt-2 text-right pr-4 font-semibold text-sm border-t border-black">Total</td>
              <td class="pt-2 text-right font-semibold text-sm border-t border-black">$${(saleInvoice.totalAmount || 0).toFixed(2)}</td>
            </tr>
          </table>
        </div>
        
        <!-- Converted footer to Tailwind classes -->
        <div class="mt-12 text-center text-gray-400 text-xs border-t border-gray-200 pt-4">
          <p>Thank you for your business</p>
        </div>
      </div>
    </body>
    </html>
  `
}
