import { chromium } from "playwright";

export async function captureScreenshot(url: string, outFile: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({ path: outFile, fullPage: true });
  await browser.close();
}
