"use server";
import { getSaleInvoiceDetail } from "@/services/saleInvoice";
import { saleInvoiceSkeleton } from "@/components/invoices/saleInvoiceSkeleton";
import puppeteer from "puppeteer";

type SaleInvoiceDetail = NonNullable<
  Awaited<ReturnType<typeof getSaleInvoiceDetail>>["data"]
>;

/**
 * Every action below resolves to one of these discriminated unions so callers
 * can narrow on `success` instead of guessing which shape they received.
 */
type InvoiceDetailResult =
  | { success: true; data: SaleInvoiceDetail; html: string }
  | { success: false; message: string };

type InvoicePdfResult =
  | { success: true; saleCode: string; pdf: string }
  | { success: false; saleCode: string; message: string };

type InvoiceHtmlResult =
  | { success: true; saleCode: string; html: string }
  | { success: false; saleCode: string; message: string };

export async function fetchSaleInvoiceData(
  saleCode: string
): Promise<InvoiceDetailResult> {
  const result = await getSaleInvoiceDetail(saleCode);

  if (!result.success || !result.data) {
    return {
      success: false,
      message: result.message || "Invoice not found",
    };
  }

  return {
    success: true,
    data: result.data,
    html: saleInvoiceSkeleton(result.data),
  };
}

export async function generateInvoicePDF(
  saleCode: string
): Promise<InvoicePdfResult> {
  const result = await fetchSaleInvoiceData(saleCode);
  if (!result.success) {
    return { success: false, saleCode, message: result.message };
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(result.html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
  });

  await browser.close();

  return {
    success: true,
    // `page.pdf()` hands back a Uint8Array, which has no base64 encoder.
    pdf: Buffer.from(pdfBuffer).toString("base64"),
    saleCode: result.data.saleCode,
  };
}

export async function previewInvoice(
  saleCode: string
): Promise<InvoiceHtmlResult> {
  const result = await fetchSaleInvoiceData(saleCode);
  if (!result.success) {
    return { success: false, saleCode, message: result.message };
  }

  return {
    success: true,
    html: result.html,
    saleCode: result.data.saleCode,
  };
}

export async function printInvoice(
  saleCode: string
): Promise<InvoiceHtmlResult> {
  const result = await fetchSaleInvoiceData(saleCode);
  if (!result.success) {
    return { success: false, saleCode, message: result.message };
  }

  return {
    success: true,
    html: `
      <html>
        <head>
          <title>Invoice ${result.data.saleCode}</title>
        </head>
        <body onload="window.print();">
          ${result.html}
        </body>
      </html>
    `,
    saleCode: result.data.saleCode,
  };
}
