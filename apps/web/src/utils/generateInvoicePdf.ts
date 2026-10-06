import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SaleItem } from '../types/invenza';

export function generateInvoicePdf(sale: SaleItem): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryColor: [number, number, number] = [34, 181, 115];
  const darkColor: [number, number, number] = [23, 33, 43];
  const mutedColor: [number, number, number] = [107, 114, 128];

  // Top Accent Bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 6, 'F');

  // Header Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...darkColor);
  doc.text('INVENZA', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('INVENTORY & SALES MANAGEMENT', 14, 25);

  // Sale Code & Date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...darkColor);
  const isTaxInvoice = sale.invoiceType === 'tax';
  doc.text(`${isTaxInvoice ? 'Tax Invoice' : 'Invoice'}: ${sale.saleCode}`, pageWidth - 14, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text(`Date: ${sale.date}`, pageWidth - 14, 25, { align: 'right' });
  doc.text(`Status: ${sale.status.toUpperCase()}`, pageWidth - 14, 30, { align: 'right' });

  // Divider
  doc.setDrawColor(232, 237, 241);
  doc.setLineWidth(0.5);
  doc.line(14, 34, pageWidth - 14, 34);

  // Customer Meta Box
  doc.setFillColor(246, 248, 250);
  doc.roundedRect(14, 40, pageWidth - 28, 24, 2, 2, 'F');
  doc.setDrawColor(232, 237, 241);
  doc.roundedRect(14, 40, pageWidth - 28, 24, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text('BILLED TO:', 18, 47);
  doc.text('PAYMENT DETAILS:', pageWidth / 2 + 10, 47);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...darkColor);
  doc.text(sale.customerName, 18, 53);
  doc.text(sale.paymentMethod, pageWidth / 2 + 10, 53);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text('customer@example.com', 18, 59);
  doc.text(`Payment Status: ${sale.status}`, pageWidth / 2 + 10, 59);

  // Line items
  const items = sale.items || [
    { name: 'Standard Inventory Item', sku: 'SKU-001', qty: 1, unitPrice: sale.amount, total: sale.amount }
  ];

  const tableRows = items.map((it) => [
    it.name,
    it.sku,
    it.qty.toString(),
    `Rs ${it.unitPrice.toFixed(2)}`,
    `Rs ${it.total.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 72,
    margin: { left: 14, right: 14 },
    head: [['Item Description', 'SKU', 'Qty', 'Unit Price', 'Amount']],
    body: tableRows,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [23, 33, 43],
      lineColor: [232, 237, 241],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [246, 248, 250],
      textColor: [107, 114, 128],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 28 },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 26, halign: 'right' },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 130;

  // Totals Box
  const totalsX = pageWidth - 80;
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text('Subtotal:', totalsX, finalY + 12);
  doc.text(`Rs ${sale.amount.toFixed(2)}`, pageWidth - 14, finalY + 12, { align: 'right' });

  let curY = finalY + 18;
  if ((sale.cgstAmount ?? 0) > 0) {
    doc.text('CGST:', totalsX, curY);
    doc.text(`Rs ${(sale.cgstAmount ?? 0).toFixed(2)}`, pageWidth - 14, curY, { align: 'right' });
    curY += 5;
  }
  if ((sale.sgstAmount ?? 0) > 0) {
    doc.text('SGST:', totalsX, curY);
    doc.text(`Rs ${(sale.sgstAmount ?? 0).toFixed(2)}`, pageWidth - 14, curY, { align: 'right' });
    curY += 5;
  }
  if ((sale.igstAmount ?? 0) > 0) {
    doc.text('IGST:', totalsX, curY);
    doc.text(`Rs ${(sale.igstAmount ?? 0).toFixed(2)}`, pageWidth - 14, curY, { align: 'right' });
    curY += 5;
  }
  if (sale.taxAmount && !sale.cgstAmount && !sale.sgstAmount && !sale.igstAmount) {
    doc.text('Tax:', totalsX, curY);
    doc.text(`Rs ${sale.taxAmount.toFixed(2)}`, pageWidth - 14, curY, { align: 'right' });
    curY += 5;
  }

  doc.setDrawColor(232, 237, 241);
  doc.line(totalsX, curY + 2, pageWidth - 14, curY + 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('Total Due:', totalsX, curY + 8);
  doc.text(`Rs ${sale.amount.toFixed(2)}`, pageWidth - 14, curY + 8, { align: 'right' });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text('Thank you for choosing DMS. For support, email support@invenza.io', 14, doc.internal.pageSize.getHeight() - 14);

  return doc;
}
