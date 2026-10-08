/**
 * Screenshot every page and key state of the DMS web app.
 *
 * Usage (with the API on :4000 and the Vite dev server on :5173):
 *   node scripts/screenshot.mjs
 *
 * Output: screenshots/NN-name.png at the repo root (not committed).
 * The API calls in `prepareState` use plain fetch: the local server .env
 * supplies the org/user headers the tenant middleware reads.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:5173";

const API = "http://localhost:4000";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "screenshots");

fs.mkdirSync(OUT, { recursive: true });

const api = async (method, url, body) => {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(data)}`);

  return data;
};

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);

async function prepareState() {
  // Idempotent across re-runs: payments only go on invoices that still have a
  // balance, and cancel/delete only target invoices that have never been paid.
  const sales = (await api("GET", "/api/sales?pageSize=30&status=Completed")).data;
  const fresh = sales.filter((s) => s.amountPaid === 0 && s.totalAmount > 10);
  const unpaid = sales.filter((s) => s.amountPaid === 0); // can be cancelled/deleted

  if (fresh.length < 2) throw new Error("need at least 2 unpaid invoices to stage payments");
  const [paidFull, paidHalf] = fresh;

  // --- payments: one fully paid, one partial, one on account (corrected) ---
  await api("POST", "/api/payments", {
    paymentCode: `PMT-SHOT-FULL-${Date.now() % 100000}`,
    customerId: paidFull.customerId,
    saleId: paidFull.id,
    amount: paidFull.totalAmount,
    method: "Cash",
  });
  await api("POST", "/api/payments", {
    paymentCode: `PMT-SHOT-HALF-${Date.now() % 100000}`,
    customerId: paidHalf.customerId,
    saleId: paidHalf.id,
    amount: Math.round(paidHalf.totalAmount / 2 * 100) / 100,
    method: "Bank Transfer",
    reference: "TRX-4471",
  });

  const onAccount = await api("POST", "/api/payments", {
    paymentCode: `PMT-SHOT-ONACC-${Date.now() % 100000}`,
    customerId: paidHalf.customerId,
    amount: 250,
    method: "Cash",
    note: "Advance against next order",
  });

  // The correction: it shows up under "Corrected payments", not in the live list.
  await api("DELETE", `/api/payments/${onAccount.id}`);

  // --- invoice lifecycle states (first candidate that accepts the call) ---
  let cancelled = null;

  for (const candidate of unpaid) {
    try {
      cancelled = await api("POST", `/api/sales/${candidate.id}/cancel`);
      break;
    } catch {
      /* a bound return can refuse; try the next invoice */
    }
  }

  if (!cancelled) throw new Error("no invoice could be cancelled");

  // Soft delete: the stock reversal needs an inventory row per product, and a
  // seeded invoice may reference one that has since gone; try the next candidate.
  let deletedSale = null;

  for (const candidate of unpaid) {
    if (candidate.id === cancelled.id) continue;

    try {
      deletedSale = await api("DELETE", `/api/sales/${candidate.id}`);
      break;
    } catch {
      /* try the next invoice */
    }
  }

  if (!deletedSale) throw new Error("no invoice could be soft-deleted (stock rows missing)");

  // --- a deleted return (never a SALE return: its reversal decrements stock) ---
  const returns = (await api("GET", "/api/returns?pageSize=20")).data;
  const softReturn = returns.find((r) => r.returnType !== "SALE") ?? returns[0];
  let deletedReturn = null;

  if (softReturn) {
    try {
      deletedReturn = await api("DELETE", `/api/returns/${softReturn.id}`);
    } catch (err) {
      log("return delete refused (kept active):", err.message.slice(0, 120));
    }
  }

  const customers = await api("GET", "/api/customers?pageSize=1");
  const products = (await api("GET", "/api/products?pageSize=1")).data;
  const purchases = (await api("GET", "/api/purchases?pageSize=1")).data;

  return {
    paidFull,
    paidHalf,
    toCancel: cancelled,
    toDelete: deletedSale,
    softReturn: deletedReturn,
    customerId: customers.data[0].id,
    productId: products[0]?.id,
    purchaseId: purchases[0]?.id,
  };
}

async function main() {
  const state = await prepareState();
  log(
    "state ready:",
    JSON.stringify({
      paid: state.paidFull.saleCode,
      partial: state.paidHalf.saleCode,
      cancelled: state.toCancel.saleCode,
      deleted: state.toDelete.saleCode,
      returnDeleted: state.softReturn?.returnCode ?? "none",
    })
  );

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  let n = 0;

  const shot = async (name) => {
    n += 1;
    const file = path.join(OUT, `${String(n).padStart(2, "0")}-${name}.png`);
    await page.waitForTimeout(450); // let SWR settle past its skeleton
    // Fixed elements paint at the current scroll offset in fullPage captures;
    // an earlier click (e.g. the dashboard's View invoice) can leave us
    // mid-page, so anchor the viewport at the top first.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: file, fullPage: true });
    log("→", path.basename(file));
  };

  const go = async (route, settle = 700) => {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(settle);
  };

  /* ---- logged out ---- */
  await go("/login");
  await shot("login");

  await page.getByPlaceholder("Enter your username").fill("admin");
  await page.getByPlaceholder("Enter your password").fill("admin123");
  await page.getByRole("button", { name: /Sign In/ }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });

  /* ---- overview ---- */
  await go("/");
  await shot("dashboard");
  // Invoice detail modal from the recent-sales widget.
  await page
    .getByRole("button", { name: /^View invoice for/ })
    .first()
    .click()
    .catch(() => log("invoice modal trigger not found"));
  await page.waitForTimeout(600);
  await shot("dashboard-invoice-modal");
  // ModalShell ignores Escape; it only closes through its labelled button.
  await page.getByRole("button", { name: "Close modal" }).click().catch(() => log("invoice modal close not found"));
  await page.waitForTimeout(300);

  // Dark theme: drive the real Topbar toggle (AppShell persists `sf_theme`;
  // the unused ThemeSwitch component's `dms-theme` key does nothing). The
  // toggle raises a 4s toast, so let it clear before each shot.
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.waitForTimeout(4600);
  await shot("dashboard-dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.waitForTimeout(4600); // keep the toast out of the following shots

  /* ---- catalogue & master data ---- */
  await go("/inventory");
  await shot("inventory");

  await go("/products");
  await shot("products");
  // Product delete sits behind the row dropdown: menu → Delete → dialog.
  await page.getByRole("button", { name: "Open menu" }).first().click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await page.waitForTimeout(400);
  await shot("products-confirm-delete");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await go("/products/new");
  await shot("product-new");
  await go(`/products/${state.productId}/edit`);
  await shot("product-edit");

  await go("/suppliers");
  await shot("suppliers");

  await go("/customers");
  await shot("customers");
  await go(`/customers/${state.customerId}/ledger`, 1200);
  await shot("customer-ledger");

  /* ---- purchases ---- */
  await go("/purchases");
  await shot("purchases");
  await go("/purchases/new");
  await shot("purchase-new");

  if (state.purchaseId) {
    await go(`/purchases/${state.purchaseId}/edit`, 1200);
    await shot("purchase-edit");
  }

  /* ---- sales ---- */
  await go("/sales");
  await shot("sales-active");

  // Paid / Partial badges, found by code so they are on screen regardless of sort.
  await page.getByPlaceholder("Search invoices by code or customer...").fill(state.paidFull.saleCode);
  await page.waitForTimeout(800);
  await shot("sales-paid-badge");
  await page.getByPlaceholder("Search invoices by code or customer...").fill(state.paidHalf.saleCode);
  await page.waitForTimeout(800);
  await shot("sales-partial-badge");
  await page.getByPlaceholder("Search invoices by code or customer...").fill(state.toCancel.saleCode);
  await page.waitForTimeout(800);
  await shot("sales-cancelled-badge");
  await page.getByPlaceholder("Search invoices by code or customer...").fill("");
  await page.waitForTimeout(800);

  // Cancel confirmation dialog (per-action copy from Checkpoint 17). The search
  // pins row one to a live invoice so the menu cannot offer Un-cancel instead.
  await page.getByPlaceholder("Search invoices by code or customer...").fill(state.paidHalf.saleCode);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Open menu" }).first().click();
  await page.getByRole("menuitem", { name: "Cancel Invoice" }).click();
  await page.waitForTimeout(400);
  await shot("sales-confirm-cancel");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Delete confirmation dialog — opened only, never confirmed.
  await page.getByRole("button", { name: "Open menu" }).first().click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await page.waitForTimeout(400);
  await shot("sales-confirm-delete");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Deleted tab (the invoice prepared earlier waits there).
  await page.getByRole("tab", { name: "deleted" }).click();
  await page.waitForTimeout(800);
  await shot("sales-deleted");

  await go("/sales/new", 1200);
  await shot("sales-new");
  await go(`/sales/${state.paidHalf.id}/edit`, 1500);
  await shot("sales-edit");

  /* ---- returns ---- */
  await go("/returns");
  await shot("returns-active");
  await page.getByRole("tab", { name: "deleted" }).click();
  await page.waitForTimeout(800);
  await shot("returns-deleted");
  await go("/returns/new", 1200);
  await shot("return-new");

  /* ---- money ---- */
  await go("/payments");
  await shot("payments-active");
  await page.getByRole("button", { name: "Corrected payments" }).click();
  await page.waitForTimeout(800);
  await shot("payments-corrected");
  await page.getByRole("button", { name: "Active payments" }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.waitForTimeout(400);
  await shot("payments-record-dialog");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  /* ---- reports & settings ---- */
  await go("/reports", 1500);
  await shot("reports");
  await go("/users");
  await shot("users");
  await go("/permissions");
  await shot("permissions");
  await go("/billing");
  await shot("billing");
  await go("/profile");
  await shot("profile");

  /* ---- mobile ---- */
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: await context.storageState(),
  });

  const mp = await mobile.newPage();
  await mp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await mp.waitForTimeout(900);
  await mp.screenshot({ path: path.join(OUT, `${++n}-mobile-dashboard.png`), fullPage: true });
  log("→ mobile-dashboard.png");
  await mp.goto(`${BASE}/sales`, { waitUntil: "networkidle" });
  await mp.waitForTimeout(900);
  await mp.screenshot({ path: path.join(OUT, `${++n}-mobile-sales.png`), fullPage: true });
  log("→ mobile-sales.png");

  await browser.close();
  log("done:", n, "screenshots in", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
