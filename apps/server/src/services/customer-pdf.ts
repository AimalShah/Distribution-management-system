import fs from "fs";
import puppeteer from "puppeteer";
import {
  renderCustomerStatementHtml,
  type CustomerStatementRenderData,
} from "./customer-statement-template";

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

export async function generateCustomerStatementPdf(
  statement: CustomerStatementRenderData
): Promise<Uint8Array> {
  const html = renderCustomerStatementHtml(statement);
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
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
