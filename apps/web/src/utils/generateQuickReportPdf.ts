import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  LowStockRow,
  ProductSalesRow,
  PurchaseBasicReport,
  SalesBasicReport,
} from '../lib/dashboard';

export interface ReportOptions {
  title?: string;
  period?: 'mtd' | 'ytd';
  /** Human window the figures were read over, e.g. "Oct 1 – Oct 8, 2026". */
  rangeLabel?: string;
  includeInventory?: boolean;
  includeSales?: boolean;
  includeSummary?: boolean;
  notes?: string;
}

/** One invoice row for the ledger table: whatever the caller actually fetched. */
export interface ReportSaleRow {
  saleCode: string;
  customerName: string;
  date: string;
  amount: number;
  status: string;
}

/**
 * The window's real figures. Every section of the PDF is computed from this
 * input — nothing is scaled from a baseline or carried over from a template —
 * so a missing report renders as an explicit "Not loaded" rather than a
 * plausible-looking number.
 */
export interface QuickReportData {
  salesReport?: SalesBasicReport;
  purchaseReport?: PurchaseBasicReport;
  topProducts: ProductSalesRow[];
  lowStock: LowStockRow[];
  /** The low-stock endpoint's `total`, which counts rows beyond this page. */
  lowStockTotal?: number;
  recentSales: ReportSaleRow[];
}

const money = (value: number) => `Rs ${value.toLocaleString()}`;

const statusColor = (status: string): [number, number, number] => {
  switch (status) {
    case 'Completed':
      return [21, 128, 61];
    case 'Pending':
      return [180, 83, 9];
    case 'Cancelled':
      return [185, 28, 28];
    default:
      return [71, 85, 105];
  }
};

const stockStatus = (row: LowStockRow): string =>
  row.quantityOnHand <= 0 ? 'Out of Stock' : 'Low Stock';

/**
 * Derive the recommendation from what the report actually contains: how many
 * lines are empty, how far the window's sales sit above its spend, and who
 * sold. An operator's own note always wins when one was typed.
 */
function derivedRecommendation(data: QuickReportData, rangeLabel: string): string {
  const outOfStock = data.lowStock.filter((row) => row.quantityOnHand <= 0).length;
  const low = data.lowStock.length - outOfStock;
  const sales = data.salesReport;
  const purchases = data.purchaseReport;

  const parts: string[] = [];

  if (outOfStock > 0) {
    parts.push(
      `${outOfStock} product${outOfStock === 1 ? ' is' : 's are'} at zero on hand — raise purchase orders for these before anything else.`,
    );
  }

  if (low > 0) {
    parts.push(
      `${low} more line${low === 1 ? ' is' : 's are'} below the reorder level (${rangeLabel}).`,
    );
  }

  if (outOfStock === 0 && low === 0) {
    parts.push('No product is at or below its reorder level right now.');
  }

  if (sales) {
    parts.push(
      `Sales over ${rangeLabel}: ${money(sales.totalSales)} across ${sales.totalOrders.toLocaleString()} invoices.`,
    );
  }

  if (purchases) {
    parts.push(`Purchase spend over the same window: ${money(purchases.totalPurchaseAmount)}.`);
  }

  if (data.topProducts.length > 0) {
    parts.push(`Top seller: ${data.topProducts[0].name} (${money(data.topProducts[0].totalPrice)}).`);
  }

  return parts.join(' ');
}

export function generateQuickReportPdf(
  data: QuickReportData,
  options: ReportOptions = {},
): jsPDF {
  const {
    period = 'mtd',
    rangeLabel = 'selected window',
    includeInventory = true,
    includeSales = true,
    includeSummary = true,
    notes = '',
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primaryColor: [number, number, number] = [34, 181, 115]; // #22B573
  const darkColor: [number, number, number] = [23, 33, 43]; // #17212B
  const mutedColor: [number, number, number] = [107, 114, 128]; // #6B7280

  // 1. Header Emerald Accent Top Bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // 2. Company Brand & Document Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...darkColor);
  doc.text('INVENZA', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('INVENTORY MANAGEMENT SYSTEM', 14, 25);

  // Right-aligned report metadata
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  const now = new Date();

  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.text(`Report ID: INV-REP-${Date.now().toString().slice(-6)}`, pageWidth - 14, 18, { align: 'right' });
  doc.text(`Generated: ${dateStr} ${timeStr}`, pageWidth - 14, 23, { align: 'right' });
  doc.text(`Window: ${rangeLabel}`, pageWidth - 14, 28, { align: 'right' });

  // Divider Line
  doc.setDrawColor(232, 237, 241);
  doc.setLineWidth(0.5);
  doc.line(14, 32, pageWidth - 14, 32);

  // Title of the Report
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...darkColor);
  const periodLabel = period === 'mtd' ? 'Month-to-Date (MTD)' : 'Year-to-Date (YTD)';
  doc.text(`Executive Inventory Health & Sales Performance Summary`, 14, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...mutedColor);
  doc.text(`Comprehensive operational audit covering inventory thresholds, stock status, and sales metrics (${periodLabel}).`, 14, 45);

  let currentY = 52;

  // 3. Executive KPI Cards — window figures, never a scaled baseline.
  if (includeSummary) {
    const sales = data.salesReport;
    const purchases = data.purchaseReport;
    const alertCount = data.lowStockTotal ?? data.lowStock.length;

    const cardWidth = (pageWidth - 28 - 9) / 4;
    const cardHeight = 18;

    const cards = [
      {
        label: 'Sales (window)',
        value: sales ? money(sales.totalSales) : 'Not loaded',
        color: [59, 130, 246] as [number, number, number],
      },
      {
        label: 'Purchases (window)',
        value: purchases ? money(purchases.totalPurchaseAmount) : 'Not loaded',
        color: [34, 181, 115] as [number, number, number],
      },
      {
        label: 'Invoices',
        value: sales ? sales.totalOrders.toLocaleString() : 'Not loaded',
        color: [139, 92, 246] as [number, number, number],
      },
      {
        label: 'Stock Alerts',
        value: `${alertCount.toLocaleString()} Items`,
        color: [239, 68, 68] as [number, number, number],
      },
    ];

    cards.forEach((card, index) => {
      const x = 14 + index * (cardWidth + 3);
      // Box background
      doc.setFillColor(246, 248, 250);
      doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'F');
      doc.setDrawColor(232, 237, 241);
      doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'S');

      // Top colored indicator line
      doc.setFillColor(...card.color);
      doc.rect(x + 1, currentY, cardWidth - 2, 1, 'F');

      // Card Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...mutedColor);
      doc.text(card.label, x + 3, currentY + 6);

      // Card Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...darkColor);
      doc.text(card.value, x + 3, currentY + 13);
    });

    currentY += 25;
  }

  // 4. Section: Inventory Health & Stock Assessment
  if (includeInventory) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...darkColor);
    doc.text('1. Inventory Health & Stock Reorder Status', 14, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedColor);
    doc.text('Products at or below their reorder level, from /inventory/low-stock.', 14, currentY + 4.5);

    const stockRows = data.lowStock.map((row) => [
      row.product.name,
      row.product.productCode,
      row.quantityOnHand.toString(),
      row.reorderLevel.toString(),
      (row.reorderLevel - row.quantityOnHand).toString(),
      stockStatus(row),
    ]);

    autoTable(doc, {
      startY: currentY + 7,
      margin: { left: 14, right: 14 },
      head: [['Product', 'Code', 'On Hand', 'Reorder', 'Short By', 'Status']],
      body:
        stockRows.length > 0
          ? stockRows
          : [['—', '—', '—', '—', '—', 'Nothing to reorder']],
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: 2.2,
        textColor: [23, 33, 43],
        lineColor: [232, 237, 241],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [246, 248, 250],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      columnStyles: {
        0: { cellWidth: 52, fontStyle: 'bold' },
        1: { cellWidth: 26 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 34, fontStyle: 'bold' },
      },
      didParseCell: (tableData) => {
        if (tableData.section === 'body' && tableData.column.index === 5) {
          const val = tableData.cell.raw;

          if (val === 'Out of Stock') {
            tableData.cell.styles.textColor = [185, 28, 28];
          } else if (val === 'Low Stock') {
            tableData.cell.styles.textColor = [217, 119, 6];
          }
        }
      },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || currentY + 40;
    currentY = finalY + 10;
  }

  // Check if page break needed
  if (currentY > pageHeight - 75 && includeSales) {
    doc.addPage();
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 4, 'F');
    currentY = 16;
  }

  // 5. Section: Recent Sales & Top Products
  if (includeSales) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...darkColor);
    doc.text('2. Recent Sales Transactions', 14, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedColor);
    doc.text('Newest invoices with their recorded status and amount.', 14, currentY + 4.5);

    const salesRows = data.recentSales.map((sale) => [
      sale.saleCode,
      sale.customerName,
      new Date(sale.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      money(sale.amount),
      sale.status,
    ]);

    autoTable(doc, {
      startY: currentY + 7,
      margin: { left: 14, right: 14 },
      head: [['Sale Code', 'Customer', 'Date', 'Amount', 'Status']],
      body:
        salesRows.length > 0
          ? salesRows
          : [['—', '—', '—', '—', 'No invoices yet']],
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: 2.2,
        textColor: [23, 33, 43],
        lineColor: [232, 237, 241],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [246, 248, 250],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold', textColor: [34, 181, 115] },
        1: { cellWidth: 50 },
        2: { cellWidth: 32 },
        3: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 26, fontStyle: 'bold' },
      },
      didParseCell: (tableData) => {
        if (tableData.section === 'body' && tableData.column.index === 4) {
          tableData.cell.styles.textColor = statusColor(String(tableData.cell.raw));
        }
      },
    });

    let afterSales =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ||
      currentY + 40;

    // Top products by revenue, the window's own ranking.
    if (data.topProducts.length > 0) {
      currentY = afterSales + 8;

      if (currentY > pageHeight - 60) {
        doc.addPage();
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 4, 'F');
        currentY = 16;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...darkColor);
      doc.text('3. Top Products by Revenue', 14, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...mutedColor);
      doc.text(`Best sellers over ${rangeLabel}, from /reports/sales/by-product.`, 14, currentY + 4.5);

      autoTable(doc, {
        startY: currentY + 7,
        margin: { left: 14, right: 14 },
        head: [['#', 'Product', 'Code', 'Units', 'Revenue']],
        body: data.topProducts.slice(0, 10).map((row, index) => [
          (index + 1).toString(),
          row.name,
          row.productCode,
          row.quantity.toLocaleString(),
          money(row.totalPrice),
        ]),
        theme: 'plain',
        styles: {
          fontSize: 8.5,
          cellPadding: 2.2,
          textColor: [23, 33, 43],
          lineColor: [232, 237, 241],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [246, 248, 250],
          textColor: [71, 85, 105],
          fontStyle: 'bold',
          fontSize: 8.5,
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 66, fontStyle: 'bold' },
          2: { cellWidth: 30 },
          3: { cellWidth: 24, halign: 'center' },
          4: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
        },
      });

      afterSales =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ||
        currentY + 40;
    }

    currentY = afterSales + 8;
  }

  // 6. Strategic Recommendations & Notes Box
  if (currentY + 28 <= pageHeight - 15) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, currentY, pageWidth - 28, 20, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 20, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...darkColor);
    doc.text('Operational Recommendation:', 18, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);

    const recText = notes || derivedRecommendation(data, rangeLabel);

    const splitText = doc.splitTextToSize(recText, pageWidth - 36);
    doc.text(splitText, 18, currentY + 11);
  }

  // 7. Footer on all pages
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(232, 237, 241);
    doc.setLineWidth(0.4);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedColor);
    doc.text('DMS Inventory Management · Confidential Operational Audit Report', 14, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }

  return doc;
}
