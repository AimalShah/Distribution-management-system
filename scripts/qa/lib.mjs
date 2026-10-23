/**
 * Shared harness for the QA scripts in `scripts/qa/`.
 *
 * Prerequisites (same as `scripts/screenshot.mjs`):
 *   - API on :4000 and the Vite dev server on :5173 (`pnpm dev` at the repo root),
 *   - a seeded database (`pnpm db:seed:owner` at minimum; `pnpm db:seed` for demo data).
 *
 * Credentials come from the environment and default to the local-dev seed pair
 * (owner@test.com / admin123 — see packages/db/prisma/owner-password.ts; these
 * are rejected by design against any hosted database).
 *
 * The scripts log in through the real UI (better-auth), then reuse the token
 * the web app itself stores (`localStorage["auth_token"]`) for API calls — the
 * same Authorization-header dialect `apps/web/src/lib/api-client.ts` uses, so a
 * guard change that breaks the web app breaks the harness too, which is the
 * point.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");

export const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:5173";
export const API_URL = process.env.QA_API_URL ?? "http://localhost:4000";
export const EMAIL = process.env.QA_EMAIL ?? "owner@test.com";
export const PASSWORD = process.env.QA_PASSWORD ?? "admin123";

const ARTIFACTS = path.join(HERE, "artifacts");
fs.mkdirSync(ARTIFACTS, { recursive: true });

export const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);

/** Wrap a scenario so a failure captures a screenshot + page HTML before rethrowing. */
export async function step(page, name, fn) {
  log(`▶ ${name}`);

  try {
    await fn();
    log(`✔ ${name}`);
  } catch (error) {
    log(`✘ ${name} — ${error.message?.split("\n")[0]}`);

    try {
      await page.screenshot({ path: path.join(ARTIFACTS, `${name.replace(/\W+/g, "-")}.png`), fullPage: true });
      fs.writeFileSync(
        path.join(ARTIFACTS, `${name.replace(/\W+/g, "-")}.html`),
        await page.content()
      );
      log(`   artifacts in scripts/qa/artifacts/`);
    } catch {
      /* the page may already be gone; the error below carries the substance */
    }

    throw error;
  }
}

/** Launch a browser, log in through the login page like the web app does, return { browser, page, token }. */
export async function launch() {
  const browser = await chromium.launch({ headless: process.env.QA_HEADLESS !== "false" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // TRANSIENT: the API dev server restarts via `tsx watch` between QA runs;
    // requests in flight during that window come back empty. Restart noise,
    // not app errors.
    if (/ERR_EMPTY_RESPONSE|favicon|websocket/i.test(message.text())) return;

    consoleErrors.push(message.text());
  });

  await step(page, "login", async () => {
    /**
     * One login attempt: returns the 429-watcher promise (or null when the
     * attempt did not even reach the API cleanly, e.g. during a restart).
     */
    const tryLogin = async () => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
      await page.getByPlaceholder(/Enter your username|Enter your email/i).fill(EMAIL);
      await page.getByPlaceholder("Enter your password").fill(PASSWORD);

      const limited = page.waitForResponse((res) => res.status() === 429 && res.url().includes("/api/auth/sign-in"), { timeout: 10_000 }).catch(() => null);

      await page.getByRole("button", { name: /Sign In/ }).click();

      return limited;
    };

    /**
     * The credential limiter counts failures per caller IP in the API
     * process's memory; it stays hot for the whole window, so a correct
     * login is blocked after ~10 recent failures from ANY tool sharing the
     * dev address — earlier QA runs included (the burst check in the guards
     * scenario guarantees this on every second full run).
     *
     * Recovery, on the operator's behalf: the dev API runs under `tsx
     * watch`, so touching a source file restarts the process and its
     * in-memory store with it. This is dev-tooling-only (it never runs
     * against a deployed API, which QA_BASE_URL would have to point at
     * deliberately) and can be turned off with QA_ALLOW_RESTART=false.
     */
    let hit = await tryLogin();

    if (hit && process.env.QA_ALLOW_RESTART !== "false") {
      log("↷ limiter store hot — restarting the dev API via tsx watch and retrying the login");

      execSync(`touch ${JSON.stringify(path.join(REPO, "apps", "server", "src", "index.ts"))}`);

      const deadline = Date.now() + 30_000;

      for (;;) {
        try {
          const res = await fetch(`${API_URL}/api/health`);

          if (res.ok) break;
        } catch {
          /* still restarting */
        }

        if (Date.now() > deadline) throw new Error("dev API did not come back healthy within 30 s after the watch restart");

        await page.waitForTimeout(1_000);
      }

      // A listen-healthy API can still drop the first in-flight auth request
      // while its Prisma pool warms, so give the click a couple of tries.
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.waitForTimeout(2_000);

        hit = await tryLogin();

        if (await page.evaluate(() => window.location.pathname).then((p) => !p.includes("/login")).catch(() => false)) {
          hit = null;

          break;
        }
      }
    }

    if (hit) {
      throw new Error(
        "the correct login was 429'd twice: the limiter store is hot and the automatic restart did not clear it " +
          "(set QA_ALLOW_RESTART=false to manage the dev server yourself)"
      );
    }

    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 });
  });

  const token = await page.evaluate(() => localStorage.getItem("auth_token"));

  if (!token) throw new Error("login succeeded but localStorage.auth_token is missing — the bearer contract changed");

  /**
   * A full page reload drops this marker; SPA route changes do not. Every
   * instant-update assertion ends by checking the marker still stands, so a
   * hidden `window.location.reload()` (the old org-switch behaviour) fails the
   * scenario loudly.
   */
  await page.evaluate(() => {
    window.__qaNoReload = true;
  });

  return {
    browser,
    page,
    token,
    consoleErrors,

    /**
     * A fresh, unauthenticated page in a brand-new context — for exercising
     * the login page itself. The shared context is already signed in, and
     * `/login` redirects a signed-in session, so only a clean context sees
     * the form.
     */
    freshPage: async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

      return context.newPage();
    },

    /** The API call the web app itself would make: bearer from localStorage. */
    api: async (method, urlPath, body) => {
      const res = await fetch(`${API_URL}/api${urlPath}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(`${method} ${urlPath} → ${res.status} ${JSON.stringify(data)}`);
      }

      return data;
    },

    /** Client-side navigation only: click a sidebar link named for the path. */
    spaNavigate: async (route) => {
      const links = [`a[href="${route}"]`, `a[href^="${route}?"]`, `a[href^="${route}"]`];

      for (const selector of links) {
        const link = page.locator(selector).first();

        if ((await link.count()) > 0) {
          await link.click();

          return;
        }
      }

      throw new Error(`no sidebar link found for ${route} — check AppSidebar.tsx`);
    },

    assertNoReload: async () => {
      const marker = await page.evaluate(() => window.__qaNoReload);

      if (!marker) {
        throw new Error("a full page reload happened mid-scenario (the marker was cleared) — instant updates must not need one");
      }
    },

    close: async () => {
      /* surface console errors so a regression is reported where it happens */
      const realErrors = consoleErrors.filter(
        (text) => !/favicon|websocket/i.test(text)
      );

      if (realErrors.length > 0) {
        log(`⚠ console errors during scenario: ${realErrors.slice(0, 5).join(" | ")}`);
      }

      await browser.close();
    },
  };
}

/**
 * Find-or-create the minimal fixture set the mutation scenarios need. The seed
 * ships demo data, but the harness stays self-sufficient: unique names mean a
 * re-run never depends on yesterday's rows, and nothing is deleted.
 */
export async function ensureFixtures({ api }) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(2, 12);

  const list = (path, key) => api("GET", `${path}?pageSize=100`).then((page) => page?.data ?? page?.[key] ?? []);

  const productId = async () => {
    const products = await list("/products", "data");
    const existing = products[0];

    if (existing?.id) return existing;

    const categories = await list("/categories", "data");
    const category =
      categories.find((c) => c.name === "QA") ??
      (await api("POST", "/categories", { name: "QA", shortCode: null, description: null }));
    const brands = await list(`/brands?categoryId=${category.id}`, "data");
    const brand =
      (brands.find((b) => b.categoryId === category.id) ??
        (await api("POST", "/brands", { name: "QA", categoryId: category.id, shortCode: null, description: null })));

    return api("POST", "/products", {
      name: `QA Widget ${stamp}`,
      category: category.id,
      brand: brand.id,
      unit: "piece",
      unitCost: 10,
      unitPrice: 25,
      gstApplicable: true,
      gstRate: 10,
      isActive: true,
    });
  };

  const customerFn = async () => {
    const customers = await list("/customers", "data");
    const existing = customers[0];

    if (existing?.id) return existing;

    return api("POST", "/customers", {
      customerCode: `QA-CUST-${stamp}`,
      name: `QA Customer ${stamp}`,
      phone: null,
      address: null,
      city: null,
      creditLimit: null,
      creditTermDays: null,
      isActive: true,
    });
  };

  const [product, customer] = await Promise.all([productId(), customerFn()]);
  const code = `QA-${stamp.slice(-8)}`;

  return { product, customer, code };
}
