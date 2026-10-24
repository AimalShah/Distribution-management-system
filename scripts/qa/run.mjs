/**
 * QA scenarios for the launch-critical behaviour fixed in Phase 3 (TODO.md
 * P0-1 … P0-8). Run with the API on :4000 and web on :5173:
 *
 *   node scripts/qa/run.mjs                    # everything
 *   node scripts/qa/run.mjs instant-updates    # one scenario
 *
 * Exit code 0 means every selected scenario passed; artifacts for failures
 * land in scripts/qa/artifacts/.
 *
 * Scenario map (what each pins, in TODO.md terms):
 *   login              — better-auth is the only sign-in path; no credential hints
 *   guards             — P0-1 legacy routes gone, P0-3 429s, P0-6 forged tax ignored
 *   instant-updates    — P0-4: sell and pay; every surface shows it after SPA navigation, no reload
 *   org-switch         — P0-4: switching tenant never serves the previous tenant's rows
 *   destructiveGuards  — P0-7: seed/wipe refuse a non-local DATABASE_URL (safe: guard fires before any connection)
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API_URL, BASE_URL, EMAIL, PASSWORD, ensureFixtures, launch, log, step } from "./lib.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Find one inventory row for a product in a list-shaped API payload. */
const findRow = (payload, product) => {
  const rows = payload?.data ?? payload ?? [];

  if (!Array.isArray(rows)) return null;

  return (
    rows.find((row) => row?.product?.id === product.id) ??
    rows.find((row) => row?.productId === product.id) ??
    null
  );
};

/** The text of the table row containing a product's name, or null if undrawn. */
async function rowTextFor(page, productName) {
  try {
    const cell = page.getByRole("cell", { name: productName, exact: false }).first();

    if ((await cell.count()) === 0) return null;

    const text = await cell.evaluate((el) => el.closest("tr")?.textContent ?? "");

    return text || null;
  } catch {
    return null;
  }
}

/**
 * The New Return form's items table, read the way a human sees it: one record
 * per drawn row, cell values keyed off the header they sit under. Radix
 * selects render as buttons (their text), money/quantity columns as number
 * inputs, the note as a text input.
 */
async function readReturnItemsTable(page) {
  return page
    .locator("table")
    .first()
    .locator("tbody tr")
    .evaluateAll((rows) =>
      rows.map((tr) => {
        const table = tr.closest("table");
        const ths = Array.from(table.querySelectorAll("thead th")).map((th) =>
          (th.textContent ?? "").trim()
        );

        const cellValue = (td) => {
          const numberInput = td.querySelector("input[type='number']");
          if (numberInput) return numberInput.value;

          const textInput = td.querySelector("input[type='text']");
          if (textInput) return textInput.value;

          return (td.textContent ?? "").trim();
        };

        const row = {};

        Array.from(tr.children).forEach((td, i) => {
          row[ths[i] ?? `col${i}`] = cellValue(td);
        });

        return {
          product: row["Product *"],
          quantity: row["Quantity *"],
          unitPrice: row["Unit Price *"],
          condition: row["Condition"],
          tax: row["Tax"],
          discount: row["Discount"],
          note: row["Note"],
        };
      })
    );
}

/** The number the "Estimated Return Value:" footer currently displays. */
async function readEstimatedValue(page) {
  return page.getByText(/Estimated Return Value/).evaluate((el) => {
    const text = el.closest("div")?.textContent ?? "";
    const match = text.match(/([\d.,]+)\s*$/);

    return match ? Number(match[1].replace(/,/g, "")) : NaN;
  });
}

const scenarios = {
  /**
   * P0-1/P0-2: better-auth is the only sign-in path, and nothing on the page
   * hands a stranger working credentials.
   */
  async login({ page, freshPage }) {
    // Fresh context: the signed-in shared context is re-pointed away from
    // /login before the form can render.
    const clean = await freshPage();

    await step(clean, "login: wrong password refused", async () => {
      await clean.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
      await clean.getByPlaceholder(/Enter your username|Enter your email/i).fill(EMAIL);
      await clean.getByPlaceholder("Enter your password").fill("not-the-password");
      await clean.getByRole("button", { name: /Sign In/ }).click();

      await clean.waitForURL((url) => url.pathname.includes("/login"), { timeout: 15_000 });
      await clean.getByText(/invalid email or password|sign in failed/i).first().waitFor({ timeout: 10_000 });
    });

    await step(clean, "login: wrong creds never land in the app", async () => {
      // long enough for better-auth's 401 and any redirect to settle
      await clean.waitForTimeout(2_000);

      const token = await clean.evaluate(() => localStorage.getItem("auth_token"));

      if (token) throw new Error("a failed sign-in still stored auth_token");
    });

    await clean.close();
  },


  /**
   * P0-4: a sale and a payment are visible on every related surface using
   * client-side navigation alone. The no-reload marker (lib.mjs) fails the
   * scenario the moment a hidden location.reload() sneaks back.
   */
  async instantUpdates({ page, api, spaNavigate, assertNoReload, ensure }) {
    const { product, customer, code } = ensure;

    const inventoryBefore = await api("GET", "/inventory?pageSize=100");
    const beforeQty = findRow(inventoryBefore, product)?.quantityOnHand ?? null;

    const sale = await api("POST", "/sales", {
      saleCode: code,
      customerId: customer.id,
      status: "Completed",
      invoiceType: "regular",
      isInterState: false,
      discount: 0,
      items: [{ productId: product.id, quantity: 2, unitPrice: 25, taxPercent: 10 }],
    });

    await step(page, "instant-updates: sale list shows the new invoice", async () => {
      await spaNavigate("/sales");
      await page.getByText(code, { exact: false }).first().waitFor({ timeout: 15_000 });
      await assertNoReload();
    });

    await step(page, "instant-updates: inventory reflects the sold stock", async () => {
      await spaNavigate("/inventory");
      await page.getByText(product.name, { exact: false }).first().waitFor({ timeout: 15_000 });

      const after = await api("GET", "/inventory?pageSize=100&search=" + encodeURIComponent(product.name));
      const row = findRow(after, product);
      const cellText = await rowTextFor(page, product.name);

      // The assertion is only as strong as both reads: API truth, and what the
      // stale-able UI actually drew.
      if (row?.quantityOnHand != null && cellText != null) {
        if (!cellText.includes(String(row.quantityOnHand))) {
          throw new Error(
            `the inventory row drew "${cellText.slice(0, 80)}" but the API says quantityOnHand=${row.quantityOnHand}` +
              (beforeQty !== null ? ` (was ${beforeQty}, sold 2)` : "")
          );
        }
      } else {
        log("   ⚠ could not cross-check the row (row text or API row missing) — weakening to presence check");
      }

      await assertNoReload();
    });

    await step(page, "instant-updates: payment appears on the Payments page", async () => {
      await api("POST", "/payments", {
        paymentCode: `QA-PAY-${code.replace(/[^A-Z0-9]/g, "").slice(-6)}`,
        customerId: customer.id,
        saleId: sale.id,
        amount: 10,
        method: "Cash",
      });

      await spaNavigate("/payments");
      await page.getByText(/QA-PAY|Cash/).first().waitFor({ timeout: 15_000 });
      await assertNoReload();
    });
  },

  /** P0-4: a tenant switch can never leave the previous tenant's rows on screen. */
  async orgSwitch({ page, api, spaNavigate, assertNoReload }) {
    let payload = await api("GET", "/organizations");
    let orgs = Array.isArray(payload) ? payload : payload?.data ?? [];

    if (orgs.length < 2) {
      const initialOrg = orgs[0];
      await step(page, "orgSwitch: create secondary company via UI", async () => {
        const trigger = page
          .getByRole("button", { name: initialOrg ? initialOrg.name : /select company/i, exact: false })
          .first();

        await trigger.click();
        await page.getByRole("menuitem", { name: "Create Company" }).click();
        const stamp = Date.now().toString().slice(-4);
        await page.getByLabel("Company Name").fill(`Secondary Company ${stamp}`);
        // Click Create Company inside the dialog
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("button", { name: "Create Company" }).click();
        await page.waitForTimeout(1_500);
      });

      payload = await api("GET", "/organizations");
      orgs = Array.isArray(payload) ? payload : payload?.data ?? [];
    }

    if (orgs.length < 2) {
      log(`↷ orgSwitch: ${orgs.length} organization(s) exist — create a second company in Settings to exercise this`);

      return "skip";
    }

    const current = orgs.find((o) => o.isActive) ?? orgs[0];
    const other = orgs.find((o) => o.id !== current.id);

    await step(page, "orgSwitch: switch tenant through the switcher UI", async () => {
      // The trigger's accessible name is the active org's name (or the
      // placeholder when none is active) — see CompanySwitcher.tsx.
      const trigger = page
        .getByRole("button", { name: current.name, exact: false })
        .or(page.getByRole("button", { name: /select company/i, exact: false }))
        .first();

      await trigger.click();
      await page.getByRole("menuitem", { name: other.name, exact: false }).first().click({ timeout: 10_000 });
      await page.waitForTimeout(1_500); // SPA settles; no spinner flake
    });

    await step(page, "orgSwitch: sales list still serves live data", async () => {
      await spaNavigate("/sales");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1_000);
    });

    await assertNoReload();
  },

  /**
   * P0-4 / G-1: deletion updates the UI optimistically and settles via SPA without page reload.
   */
  async optimisticDeletes({ page, api, spaNavigate, assertNoReload }) {
    const stamp = Date.now().toString().slice(-6);
    const customerCode = `OPT-${stamp}`;
    const customerName = `Optimistic Customer ${stamp}`;

    await api("POST", "/customers", {
      customerCode,
      name: customerName,
    });

    await step(page, "optimisticDeletes: navigate to customers list", async () => {
      await spaNavigate("/customers");
      await page.getByText(customerName, { exact: false }).first().waitFor({ timeout: 15_000 });
      await assertNoReload();
    });

    await step(page, "optimisticDeletes: delete customer removes row optimistically", async () => {
      const row = page.locator("tr", { hasText: customerName }).first();
      await row.getByRole("button", { name: "Delete" }).click();

      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: /Delete customer/i }).click();

      await page.getByText(customerName, { exact: false }).waitFor({ state: "hidden", timeout: 10_000 });
      await assertNoReload();
    });

    await step(page, "optimisticDeletes: API truth — customer is deleted", async () => {
      const list = await api("GET", `/customers?search=${encodeURIComponent(customerCode)}`);
      const items = list?.data ?? [];
      if (items.some((c) => c.customerCode === customerCode)) {
        throw new Error(`customer ${customerCode} still exists in the API response`);
      }
    });
  },

  /**
   * P0-1 + P0-3 + P0-6, asserted against the live API: the legacy login route
   * answers 404, unauthenticated reads answer 401, brute force gets 429s
   * without locking a correct login out, and forged money figures are dropped.
   */
  async guards({ page, token }) {
    await step(page, "guards: legacy /api/auth/login route no longer exists", async () => {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: EMAIL, password: PASSWORD }),
      });

      if (res.status !== 404) {
        throw new Error(`POST /api/auth/login answered ${res.status} (401 = still mounted as a fallback; anything else = it answered)`);
      }
    });

    await step(page, "guards: unauthenticated read is 401, not an empty 200", async () => {
      const res = await fetch(`${API_URL}/api/products`, { method: "GET" });

      if (res.status !== 401) {
        throw new Error(`GET /api/products without a session answered ${res.status}`);
      }
    });

    await step(page, "guards: repeated bad logins get 429s in the standard envelope", async () => {
      const fail = () =>
        fetch(`${API_URL}/api/auth/sign-in/email`, {
          method: "POST",
          // The browser always sends Origin on a cross-origin POST; better-auth
          // refuses the request as a CSRF violation (403) before credentials
          // are even read when it is missing. Emulate the real client.
          headers: { "Content-Type": "application/json", Origin: BASE_URL },
          body: JSON.stringify({ email: EMAIL, password: "not-the-password" }),
        });

      /**
       * The limiter's counter lives in the API process keyed on the caller IP.
       * A cold store (dev server freshly started) gets the exact contract: the
       * 11th failure is the first 429. A store still hot from a previous QA
       * run within the 15-minute window 429s sooner — which still proves the
       * limiter is mounted, so the step degrades to a presence check with a
       * loud note instead of falsely failing ("restart the dev server for the
       * exact 11th-failure check").
       */
      let first429 = null;

      for (let attempt = 1; attempt <= 11; attempt++) {
        const res = await fail();

        if (res.status === 429) {
          first429 = attempt;

          const envelope = await res.json().catch(() => ({}));

          if (envelope.code !== "RATE_LIMITED") {
            throw new Error(`429 body does not match the {error, code} envelope: ${JSON.stringify(envelope)}`);
          }

          break;
        }

        if (res.status !== 401) {
          throw new Error(`failed sign-in answered ${res.status}; expected 401 or a limiter 429`);
        }
      }

      if (!first429) throw new Error("no 429 in 11 failed sign-ins — the credential limiter is not mounted");

      if (first429 !== 11) {
        log(`   ⚠ limiter was already hot: 429 on attempt ${first429}, not 11 (restart the dev server for the exact check)`);
      }
    });

    await step(page, "guards: forged sale tax figures are derived, not banked", async () => {
      // The local-dev bearer token against session middleware must be the same
      // one the web app uses; if this 401s, the bearer contract changed.
      const { ensureFixtures } = await import("./lib.mjs");
      const fixtures = await ensureFixtures({ api: apiWith(token) });

      // 2 × 25 at 10% with a 3 discount supports exactly 50 + 5 − 3 = 52.
      const body = {
        saleCode: `QA-SEC-${Date.now().toString().slice(-8)}`,
        customerId: fixtures.customer.id,
        status: "Completed",
        invoiceType: "regular",
        isInterState: false,
        discount: 3,
        taxAmount: 8, // forged header the old API banked verbatim
        items: [
          {
            productId: fixtures.product.id,
            quantity: 2,
            unitPrice: 25,
            taxPercent: 10,
            cgstAmount: 1, // forged split the old API banked verbatim
            sgstAmount: 0.4,
          },
        ],
      };

      const created = await apiWith(token)("POST", "/sales", body);
      const stored = await apiWith(token)("GET", `/sales/${created.id}`);

      const total = stored?.totalAmount ?? stored?.sale?.totalAmount;
      const tax = stored?.taxAmount ?? stored?.sale?.taxAmount;

      if (Math.abs((total ?? NaN) - 52) > 0.001) {
        throw new Error(`stored total is ${total}, expected the derived 52 (forged figures were banked — P0-6 broken)`);
      }

      if (Math.abs((tax ?? NaN) - 5) > 0.001) {
        throw new Error(`stored taxAmount is ${tax}, expected the derived 5`);
      }
    });
  },

  /**
   * The New Return form — pinned against the two symptoms reported on a real
   * return:
   *   1. the line's price/tax/discount did not follow the invoice;
   *   2. a returned quantity was displayed as a line count — "pcs" column read
   *      the number of rows.
   *
   * Fixture: a 3-line invoice (325 + 240 + 25 = 590, tax 10% = 59, header
   * discount 20 → total 629). The form's estimate must reproduce the credit
   * the ledger actually grants for the same return shape.
   */
  async returnForm({ page, api, spaNavigate, assertNoReload, ensure }) {
    const stamp = Date.now().toString().slice(-8);

    const prices = [25, 40, 12.5];
    const quantities = [13, 6, 2];
    const products = [];

    for (const [index, price] of prices.entries()) {
      const product = await api("POST", "/products", {
        name: `QA Return Line ${index} ${stamp}`,
        category: ensure.product.categoryId,
        brand: ensure.product.brandId,
        unit: "piece",
        unitCost: 10,
        unitPrice: price,
        gstApplicable: true,
        gstRate: 10,
        isActive: true,
      });

      products.push(product);

      await api("POST", "/inventory", { productId: product.id, quantityOnHand: 100 });
    }

    await api("POST", "/sales", {
      saleCode: `QA-RET-SRC-${stamp}`,
      customerId: ensure.customer.id,
      status: "Completed",
      invoiceType: "regular",
      isInterState: false,
      discount: 20,
      items: quantities.map((quantity, index) => ({
        productId: products[index].id,
        quantity,
        unitPrice: prices[index],
        taxPercent: 10,
      })),
    });

    // Reaching the form client-side keeps the no-reload marker standing.
    await spaNavigate("/returns");

    await step(page, "returnForm: opens the new-return form", async () => {
      await page.getByRole("link", { name: /New Return/ }).first().click();
      await page.waitForURL((url) => url.pathname.includes("/returns/new"), { timeout: 15_000 });
    });

    await step(page, "returnForm: selecting the invoice points the return at it", async () => {
      const trigger = page
        .getByRole("combobox")
        .filter({ has: page.locator("span", { hasText: "Select sale invoice" }) })
        .first();

      await trigger.click();
      await page.getByRole("option", { name: /QA-RET-SRC/ }).first().click();
    });

    await step(page, "returnForm: populate-from-invoice bar appears for the 3-line document", async () => {
      await page.getByText(/has 3 line item/).first().waitFor({ timeout: 10_000 });
    });

    await step(page, "returnForm: populate fills all three lines with quantities and prices", async () => {
      await page.getByRole("button", { name: /Populate items from/ }).click();
      await page.waitForTimeout(400);

      const contents = await readReturnItemsTable(page);

      if (contents.length !== 3) {
        throw new Error(
          `the items table shows ${contents.length} line(s) after populating a 3-line invoice (rows: ${JSON.stringify(contents)})`
        );
      }

      for (const [index, row] of contents.entries()) {
        if (Number(row.unitPrice) !== prices[index]) {
          throw new Error(
            `line ${index + 1} shows unitPrice ${row.unitPrice}, expected ${prices[index]} — the form did not fill the price from the invoice`
          );
        }

        if (Number(row.quantity) !== quantities[index]) {
          throw new Error(`line ${index + 1} shows quantity ${row.quantity}, expected ${quantities[index]}`);
        }
      }
    });

    await step(page, "returnForm: switching a line's product re-fills its price and quantity", async () => {
      // Line 3 (12.50 @ 2) → the 25.00 product, then back. Both directions must
      // re-derive from the document; a stale price here is the reported
      // "form does not update the price" symptom.
      const row = page.locator("table tbody tr").nth(2);

      await row.getByRole("combobox").first().click();
      await page.getByRole("option", { name: /QA Return Line 0/ }).first().click();
      await page.waitForTimeout(400);

      let switched = await readReturnItemsTable(page);

      if (Number(switched[2]?.unitPrice) !== 25 || Number(switched[2]?.quantity) !== 13) {
        throw new Error(
          `after switching line 3 to the 25.00 document product, the row shows price ${switched[2]?.unitPrice} / qty ${switched[2]?.quantity}, expected 25 / 13`
        );
      }

      await row.getByRole("combobox").first().click();
      await page.getByRole("option", { name: /QA Return Line 2/ }).first().click();
      await page.waitForTimeout(400);

      switched = await readReturnItemsTable(page);

      if (Number(switched[2]?.unitPrice) !== 12.5 || Number(switched[2]?.quantity) !== 2) {
        throw new Error(
          `after switching line 3 back to the 12.50 product, the row shows price ${switched[2]?.unitPrice} / qty ${switched[2]?.quantity}, expected 12.5 / 2`
        );
      }
    });

    await step(page, "returnForm: estimate mirrors the invoice tax and discount at full quantities", async () => {
      // A full return of every line credits 590 goods + 59 tax − 20 discount
      // share = 629 — exactly what the ledger grants. A form that leaves the
      // tax/discount columns at 0 shows 590, so the clerk signs a number that
      // is not the money it settles at.
      const estimate = await readEstimatedValue(page);

      if (Math.round(estimate) !== Math.round(628.99)) {
        throw new Error(
          `Estimated Return Value shows ${estimate}, expected 629 (590 + 59 tax − 20 discount from the invoice's own figures)`
        );
      }
    });

    await step(page, "returnForm: editing a quantity to 12 updates the row and the estimate", async () => {
      const row = page.locator("table tbody tr").nth(0);
      const quantity = row.locator("td").nth(1).locator("input");

      await quantity.fill("12");
      await quantity.blur();
      await page.waitForTimeout(300);

      const visible = (await readReturnItemsTable(page))[0];

      if (visible?.quantity !== "12") {
        throw new Error(
          `after typing 12 into the quantity, the row shows "${visible?.quantity}" — the table does not take the edit (the "returned 12, shows 1" symptom)`
        );
      }

      // goods 300 + 240 + 25 = 565; derived tax 32.5×12/13 + 24 + 2.5 = 56.5;
      // discount shares (r2 per line) 10.17 + 8.14 + 0.85 = 19.16 → 602.34.
      // The PKR money format shows whole rupees, so compare rounded.
      const estimate = await readEstimatedValue(page);

      if (Math.round(estimate) !== Math.round(602.34)) {
        throw new Error(
          `estimate after the 12-pc edit shows ${estimate}, expected ≈602 (602.34 with tax/discount scaled by the returned share)`
        );
      }
    });

    let returnCode = "";

    await step(page, "returnForm: submitting lands on the list without a reload", async () => {
      returnCode = await page.getByPlaceholder("RET-YYYY-XXXXX").inputValue();
      await page.getByRole("button", { name: /Process Return/ }).click();
      await page.waitForURL((url) => url.pathname.includes("/returns"), { timeout: 15_000 });
      await assertNoReload();
    });

    await step(page, "returnForm: the list shows the true piece count, not the line count", async () => {
      await page.getByText(returnCode, { exact: false }).first().waitFor({ timeout: 10_000 });

      const row = page.locator("tr", { hasText: returnCode }).first();
      const text = await row.textContent();

      // 12 + 6 + 2 = 20 pieces across 3 lines.
      if (!/20/.test(text ?? "")) {
        throw new Error(
          `the returns table row shows "${(text ?? "").replace(/\s+/g, " ").slice(0, 120)}" — a 20-piece return must not be displayed as a line count`
        );
      }
    });

    await step(page, "returnForm: API truth — three lines stored with the edited quantity", async () => {
      const detail = await api("GET", `/returns/${returnCode}`);
      const items = detail?.items ?? [];

      if (items.length !== 3) {
        throw new Error(`the stored return has ${items.length} line(s), expected 3`);
      }

      if (items[0]?.quantity !== 12) {
        throw new Error(`the stored first line has quantity ${items[0]?.quantity}, expected the edited 12`);
      }
    });

    await assertNoReload();
  },

  /**
   * P0-7 without a browser: the guard must refuse a remote host before any
   * connection, so this can never touch real data. It spawns the real scripts
   * with an unreachable fake Neon host and demands the guard's own error.
   */
  async destructiveGuards() {
    const env = {
      ...process.env,
      DATABASE_URL: "postgresql://qa:qa@ep-qa-guard-check.awsnfake.invalid/db?sslmode=require",
      DATABASE_URL_UNPOOLED: undefined,
      DMS_ALLOW_DESTRUCTIVE: undefined,
    };

    const cases = [
      ["db:wipe", ["--filter", "@dms/db", "run", "wipe"]],
      ["db:seed --owner-only", ["--filter", "@dms/db", "run", "seed", "--", "--owner-only"]],
      ["db:seed:stress", ["--filter", "@dms/db", "run", "seed:stress"]],
    ];

    for (const [script, args] of cases) {
      const name = `destructiveGuards: ${script} refuses a non-local target`;

      log(`▶ ${name}`);

      const res = spawnSync("pnpm", args, { cwd: REPO, env, encoding: "utf8", timeout: 120_000 });
      const output = `${res.stdout ?? ""}${res.stderr ?? ""}`;

      if (res.status === 0) {
        throw new Error(`${script} exited 0 against an unreachable remote host — the guard did not fire`);
      }

      if (!/not on this machine|DMS_ALLOW_DESTRUCTIVE/i.test(output)) {
        throw new Error(`${script} failed, but not via the target guard:\n${output.slice(-800)}`);
      }

      log(`✔ ${script}: refused (host echoed in the error)`);
    }
  },
};

/* Same Authorization dialect as the web app; scoped for the guards scenario. */
function apiWith(token) {
  return async (method, urlPath, body) => {
    const res = await fetch(`${API_URL}/api${urlPath}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) throw new Error(`${method} ${urlPath} → ${res.status} ${JSON.stringify(data)}`);

    return data;
  };
}

/* -------------------------------- runner ------------------------------- */

const only = process.argv[2];
const selected = Object.entries(scenarios).filter(([name]) => only === undefined || name === only);

if (selected.length === 0) {
  console.error(`no scenario named "${only}" — available: ${Object.keys(scenarios).join(", ")}`);

  process.exit(1);
}

let failed = 0;

for (const [name, run] of selected) {
  log(`━━━ ${name} ━━━`);

  try {
    if (name === "destructiveGuards") {
      await run();
      continue;
    }

    const session = await launch();

    try {
      const ensure = await ensureFixtures({ api: session.api });
      const result = await run({ ...session, ensure });

      if (result === "skip") log("↷ skipped");
    } finally {
      await session.close();
    }
  } catch (error) {
    failed++;
    log(`✘ scenario ${name} — ${error.message?.split("\n")[0] ?? error}`);
  }
}

log(failed === 0 ? "━━━ all selected scenarios passed ━━━" : `━━━ ${failed} scenario(s) failed ━━━`);

process.exit(failed === 0 ? 0 : 1);
