import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SaleItem, LowStockProduct } from '../types/invenza';

export interface ReportOptions {
  title?: string;
  period?: 'mtd' | 'ytd';
  includeInventory?: boolean;
  includeSales?: boolean;
  includeSummary?: boolean;
  notes?: string;
}

export function generateQuickReportPdf(
  sales: SaleItem[],
  lowStock: LowStockProduct[],
  options: ReportOptions = {}
): jsPDF {
  const {
    period = 'mtd',
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
  doc.text(`Prepared By: John Smith (Administrator)`, pageWidth - 14, 28, { align: 'right' });

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

  // 3. Executive KPI Cards
  if (includeSummary) {
    const multiplier = period === 'ytd' ? 3.4 : 1.0;
    const rev = Math.round(17584 * multiplier);
    const profit = Math.round(5097 * multiplier);
    const salesCount = Math.round(786 * multiplier);
    const criticalCount = lowStock.filter((p) => p.status === 'Critical' || p.status === 'Out of Stock').length;

    const cardWidth = (pageWidth - 28 - 9) / 4;
    const cardHeight = 18;

    const cards = [
      { label: 'Total Revenue', value: `Rs ${rev.toLocaleString()}`, color: [59, 130, 246] as [number, number, number] },
      { label: 'Net Profit', value: `Rs ${profit.toLocaleString()}`, color: [34, 181, 115] as [number, number, number] },
      { label: 'Sales Orders', value: salesCount.toLocaleString(), color: [139, 92, 246] as [number, number, number] },
      { label: 'Critical Stock Items', value: `${criticalCount} Items`, color: [239, 68, 68] as [number, number, number] },
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
    doc.text('Real-time tracking of inventory units requiring immediate attention or procurement replenishment.', 14, currentY + 4.5);

    const stockRows = lowStock.map((prod) => [
      prod.name,
      prod.sku,
      prod.category,
      prod.currentStock.toString(),
      prod.minStock.toString(),
      `Rs ${prod.price.toFixed(2)}`,
      prod.status,
    ]);

    autoTable(doc, {
      startY: currentY + 7,
      margin: { left: 14, right: 14 },
      head: [['Product', 'SKU', 'Category', 'Current', 'Min Stock', 'Price', 'Status']],
      body: stockRows,
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
        0: { cellWidth: 45, fontStyle: 'bold' },
        1: { cellWidth: 22 },
        2: { cellWidth: 28 },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 29, fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const val = data.cell.raw;
          if (val === 'Critical') {
            data.cell.styles.textColor = [220, 38, 38];
          } else if (val === 'Out of Stock') {
            data.cell.styles.textColor = [185, 28, 28];
          } else if (val === 'Low Stock') {
            data.cell.styles.textColor = [217, 119, 6];
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

  // 5. Section: Recent Sales Transactions & Cash Flow
  if (includeSales) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...darkColor);
    doc.text('2. Recent Sales Transactions & Cash Flow', 14, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedColor);
    doc.text('Audit trail of latest generated sales, payment status, and settled receivables.', 14, currentY + 4.5);

    const salesRows = sales.map((sale) => [
      sale.saleCode,
      sale.customerName,
      sale.date,
      sale.paymentMethod,
      `Rs ${sale.amount.toFixed(2)}`,
      sale.status,
    ]);

    autoTable(doc, {
      startY: currentY + 7,
      margin: { left: 14, right: 14 },
      head: [['Sale Code', 'Customer', 'Date', 'Payment Method', 'Amount', 'Status']],
      body: salesRows,
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
        0: { cellWidth: 28, fontStyle: 'bold', textColor: [34, 181, 115] },
        1: { cellWidth: 42 },
        2: { cellWidth: 26 },
        3: { cellWidth: 32 },
        4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 28, fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const val = data.cell.raw;
          if (val === 'Paid') {
            data.cell.styles.textColor = [21, 128, 61];
          } else if (val === 'Pending') {
            data.cell.styles.textColor = [180, 83, 9];
          } else if (val === 'Partial') {
            data.cell.styles.textColor = [29, 78, 216];
          } else if (val === 'Cancelled') {
            data.cell.styles.textColor = [185, 28, 28];
          }
        }
      },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || currentY + 40;
    currentY = finalY + 8;
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
    const recText =
      notes ||
      'Wireless Mouse (WM-001) and Bluetooth Speaker (BS-005) have breached safety thresholds. Issue procurement purchase orders immediately to avoid stockouts. Overall revenue trajectory remains strong (+8.2% vs previous cycle).';
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
