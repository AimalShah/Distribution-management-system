import { describe, expect, it } from "vitest";
import { renderSaleInvoiceHtml } from "./sale-invoice-template";
import { renderCustomerStatementHtml } from "./customer-statement-template";
import { renderCreditNoteHtml } from "./credit-note-template";
import { renderPaymentReceiptHtml } from "./payment-receipt-template";
import { renderPurchaseOrderHtml } from "./purchase-order-template";

describe("PDF templates company name rendering", () => {
  it("renders 'AM Enterprise' on Sale Invoice by default", () => {
    const html = renderSaleInvoiceHtml({
      saleCode: "INV-0001",
      saleDate: "2026-10-25T00:00:00Z",
      status: "COMPLETED",
      totalAmount: 100,
    });

    expect(html).toContain("AM Enterprise");
    expect(html).not.toContain("Distribution Management System");
  });

  it("renders custom company name on Sale Invoice when provided", () => {
    const html = renderSaleInvoiceHtml({
      saleCode: "INV-0001",
      saleDate: "2026-10-25T00:00:00Z",
      status: "COMPLETED",
      totalAmount: 100,
      company: { name: "Custom Distributor LLC" },
    });

    expect(html).toContain("Custom Distributor LLC");
  });

  it("renders 'AM Enterprise' on Customer Statement by default", () => {
    const html = renderCustomerStatementHtml({
      customer: {
        id: "c_1",
        customerCode: "CUST-001",
        name: "Acme Retail",
      },
      openingBalance: 0,
      entries: [],
      totals: {
        invoices: 0,
        credits: 0,
        payments: 0,
        closingBalance: 0,
      },
    });

    expect(html).toContain("AM Enterprise");
    expect(html).not.toContain("Distribution Management System");
  });

  it("renders 'AM Enterprise' on Credit Note by default and in footer", () => {
    const html = renderCreditNoteHtml({
      returnRecord: {
        id: "ret_1",
        returnCode: "RET-0001",
        returnType: "SALE",
        returnDate: "2026-10-25T00:00:00Z",
        items: [],
      },
    });

    expect(html).toContain("AM Enterprise");
    expect(html).toContain("Generated via AM Enterprise");
    expect(html).not.toContain("DISTRIBUTION MANAGEMENT");
    expect(html).not.toContain("Distribution Management System");
  });

  it("renders 'AM Enterprise' on Payment Receipt by default", () => {
    const html = renderPaymentReceiptHtml({
      payment: {
        id: "pay_12345678",
        amount: 250,
        paidAt: "2026-10-25T00:00:00Z",
      },
    });

    expect(html).toContain("AM Enterprise");
    expect(html).not.toContain("DISTRIBUTION MANAGEMENT");
    expect(html).not.toContain("Distribution Management System");
  });

  it("renders 'AM Enterprise' on Purchase Order by default, in bill-to, and in footer", () => {
    const html = renderPurchaseOrderHtml({
      purchase: {
        id: "pur_1",
        purchaseCode: "PO-0001",
        purchaseDate: "2026-10-25T00:00:00Z",
        status: "RECEIVED",
        totalAmount: 500,
        supplier: {
          id: "sup_1",
          companyName: "Global Supplies",
        },
        purchaseItems: [],
      },
    });

    expect(html).toContain("AM Enterprise");
    expect(html).toContain("Generated via AM Enterprise");
    expect(html).not.toContain("DISTRIBUTION MANAGEMENT");
    expect(html).not.toContain("Distribution Management System");
  });
});
