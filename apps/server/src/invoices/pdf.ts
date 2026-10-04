import fs from "node:fs";
import puppeteer from "puppeteer-core";

/**
 * `puppeteer-core`, not `puppeteer`: the full package downloads its own
 * Chromium (~170 MB) on install, into every developer machine and CI run,
 * whether or not anyone prints an invoice. This drives a Chrome or Edge that
 * is already installed instead. `CHROME_PATH` names it explicitly; otherwise
 * the usual install locations are tried.
 */
const CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

export function findBrowser(): string | undefined {
  return CANDIDATES.find((p): p is string => Boolean(p) && fs.existsSync(p!));
}

/**
 * Print an HTML document to an A4 PDF. A fresh browser per call: invoices are
 * printed one at a time by a person, and a long-lived browser is a process to
 * supervise for no measurable gain at that rate.
 *
 * JavaScript is disabled in the page. The invoice HTML has none, and anything
 * that slipped past escaping would otherwise run inside a browser on the server.
 */
export async function htmlToPdf(html: string, executablePath: string): Promise<Uint8Array> {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: "load" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
}
