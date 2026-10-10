import fs from "fs";
import puppeteer from "puppeteer";
import {
  renderPurchaseOrderHtml,
  type PurchaseOrderRenderData,
} from "./purchase-order-template";

function findChromePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidates = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export async function generatePurchasePdf(
  data: PurchaseOrderRenderData
): Promise<Uint8Array> {
  const html = renderPurchaseOrderHtml(data);
  const executablePath = findChromePath();

  const browser = await puppeteer.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
