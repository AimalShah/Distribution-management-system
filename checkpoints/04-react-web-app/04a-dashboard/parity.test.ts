/**
 * Checkpoint 4a — Dashboard: Parity Test
 *
 * Scope: what the mocked suites cannot see, namely that the port is a port.
 * `apps/server/src/routes/dashboard.test.ts` pins the endpoint's behavior and
 * `apps/server/src/routes/*.test.ts` pin the report and low-stock endpoints, so
 * this suite does not repeat any of that. What it asserts is the shape of the
 * migration itself:
 *
 *   - every widget the legacy dashboard renders is rendered by the new page,
 *     under the name it was ported to;
 *   - the page reads the endpoints the plan lists, through a window the report
 *     schema actually accepts (`?days=30` is silently stripped by Zod and would
 *     chart every sale the organization has ever made under a "last 30 days"
 *     heading);
 *   - the legacy field names that do not exist on the Prisma models have not
 *     been copied into `apps/web` along with everything else;
 *   - the screen is mounted behind the shell rather than at the router root.
 *
 * These are file reads rather than a rendered DOM: `apps/web` has no testing
 * library and adding one to assert that a string appears in the output of a
 * component whose source this suite already reads would be a slower way to ask
 * the same question. Rendering, loading and error states are checked when the
 * app grows a component test setup in 04b.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// `checkpoints/<checkpoint>/<sub>/parity.test.ts` → the repository root.
const root = path.resolve(__dirname, "../../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);

  return fs.readFileSync(full, "utf-8");
};

/**
 * Legacy widget → the component it became. The legacy names are still in the
 * Next.js tree under `src/`, so both sides are read rather than trusting this
 * table to describe either one.
 */
const WIDGETS: Readonly<Record<string, string>> = {
  DashboardStats: "Stats",
  SalesLineChartInteractive: "SalesChart",
  LowStockAlert: "LowStockAlert",
  InventoryChart: "InventoryChart",
  TopProducts: "TopProducts",
  RecentActivities: "RecentActivities",
};

const page = read("apps/web/src/pages/Dashboard.tsx");

const legacy = read("src/app/(app)/dashboard/page.tsx");

describe("Checkpoint 4a — Dashboard", () => {
  it("renders every widget the legacy dashboard renders", () => {
    for (const [legacyName, portedName] of Object.entries(WIDGETS)) {
      expect(
        legacy,
        `the legacy dashboard no longer renders <${legacyName}>; WIDGETS is stale`
      ).toContain(`<${legacyName}`);
      expect(
        page,
        `the new dashboard does not render the port of <${legacyName}>`
      ).toContain(`<${portedName}`);
    }
  });

  it("has a component module for each ported widget", () => {
    for (const name of new Set(Object.values(WIDGETS))) {
      expect(
        fs.existsSync(
          path.join(root, `apps/web/src/components/dashboard/${name}.tsx`)
        ),
        `${name}.tsx should exist`
      ).toBe(true);
    }
  });

  it("reads the four endpoints the plan lists", () => {
    expect(page).toContain('"/dashboard/stats"');
    expect(page).toContain("/reports/sales/basic");
    expect(page).toContain("/reports/sales/by-product");
    expect(page).toContain("/inventory/low-stock");
  });

  it("windows the report queries with a range the schema accepts", () => {
    // `reportRangeQuerySchema` is `{ startDate?, endDate? }`; Zod strips
    // unknown keys rather than failing, so a `days` param is a no-op.
    expect(page).not.toMatch(/[?&]days=/);
    expect(page).toContain("startDate");
    expect(page).toContain("endDate");
  });

  it("shows a skeleton while a panel is loading and an empty state when it is not", () => {
    expect(page).toMatch(/isLoading/);

    // Every card but the stat grid goes through `Panel`, which owns both
    // states; one that skipped it would render a blank rectangle instead.
    // `Stats` is excluded because it is six independent tiles with no shared
    // title or empty state, and wrapping them would invent one.
    const sharedPanels = Object.values(WIDGETS).filter(
      (name) => name !== "Stats"
    );

    for (const name of sharedPanels) {
      const source = read(`apps/web/src/components/dashboard/${name}.tsx`);
      expect(
        source,
        `${name} should render through Panel so loading and empty states are shared`
      ).toMatch(/<Panel\b/);
      expect(
        source,
        `${name} should take a loading prop`
      ).toMatch(/loading\?/);
    }

    // The stat grid keeps its own skeleton, which is the assertion above for
    // the component that does not use Panel.
    expect(
      read("apps/web/src/components/dashboard/Stats.tsx")
    ).toContain("<Skeleton");
  });

  it("does not carry the legacy field names the API never had", () => {
    const webSrc = path.join(root, "apps/web/src");
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const source = fs.readFileSync(full, "utf-8");

          if (/invoiceNumber|purchaseOrderNumber/.test(source)) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };

    walk(webSrc);

    expect(
      offenders,
      "Sale has saleCode and Purchase has purchaseCode; these names only exist in the legacy Next.js UI"
    ).toEqual([]);
  });

  it("mounts the screen behind the app shell, not at the router root", () => {
    const app = read("apps/web/src/App.tsx");
    expect(app).toContain("AppShell");
    // A bare `<Route path="/" element={<Dashboard />} />` would render the
    // page without the sidebar or top bar the shell provides.
    expect(app).toMatch(/<Route element={<AppShell\s*\/>}>\s*<Route path="\/"/);
  });

  it("serves the aggregated stats the page depends on", () => {
    const routes = read("apps/server/src/routes/index.ts");
    expect(routes).toContain("dashboardRouter");

    const service = read("apps/server/src/services/dashboard.ts");

    for (const field of [
      "totalSalesAmount",
      "totalPurchasesAmount",
      "lowStockCount",
      "recentSales",
      "recentPurchases",
      "topInventory",
    ]) {
      expect(service, `stats payload should include ${field}`).toContain(field);
    }
  });
});
