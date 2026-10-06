import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SaleItem } from '../types';

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

  // Invoice Number & Date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...darkColor);
  doc.text(`INVOICE: ${sale.invoiceNumber}`, pageWidth - 14, 20, { align: 'right' });

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
    `$${it.unitPrice.toFixed(2)}`,
    `$${it.total.toFixed(2)}`,
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
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: 30, font: 'courier' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
  });

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.08;
  const grandTotal = subtotal + tax;
  const finalY = (doc as any).lastAutoTable?.finalY || 130;

  // Summary breakdown
  const summaryX = pageWidth - 70;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text('Subtotal:', summaryX, finalY + 10);
  doc.setTextColor(...darkColor);
  doc.text(`$${subtotal.toFixed(2)}`, pageWidth - 14, finalY + 10, { align: 'right' });

  doc.setTextColor(...mutedColor);
  doc.text('Tax (8%):', summaryX, finalY + 16);
  doc.setTextColor(...darkColor);
  doc.text(`$${tax.toFixed(2)}`, pageWidth - 14, finalY + 16, { align: 'right' });

  doc.setDrawColor(232, 237, 241);
  doc.line(summaryX, finalY + 20, pageWidth - 14, finalY + 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('Total Due:', summaryX, finalY + 27);
  doc.text(`$${grandTotal.toFixed(2)}`, pageWidth - 14, finalY + 27, { align: 'right' });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text('Thank you for your business. For any invoice queries, contact accounting@invenza.com.', 14, 275);
  doc.text('Invenza Inventory Management System · Generated Electronically', 14, 280);

  return doc;
}
