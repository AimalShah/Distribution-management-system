/**
 * Checkpoint 4i — Reports Page: Parity Test
 *
 * Scope: asserts the shape, contract, and behavioral integrity of the ported
 * Reports & Analytics screens (ReportsPage, SalesReportTab, PurchaseReportTab, InventoryReportTab):
 *
 *   - ReportsPage renders DateRangePicker from `@dms/ui` and period selector;
 *   - Tabs for Sales, Purchase, and Inventory reports are rendered;
 *   - SalesReportTab renders KPI cards, Sales Over Time chart, and customer/product breakdowns;
 *   - PurchaseReportTab renders KPI cards, Purchases Over Time chart, and supplier/product breakdowns;
 *   - InventoryReportTab renders stock valuation, movement audit logs, and low-stock alerts;
 *   - Date range picker filters data and synchronizes query params;
 *   - Recharts components render with accessible tooltips and empty states;
 *   - Routes are mounted under AppShell in App.tsx and linked in AppSidebar;
 *   - No legacy unbacked field names appear in web source;
 *   - When a database is available, API contracts for sales, purchase, and inventory reports
 *     are verified end-to-end against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  app,
  asOrg,
  hasDatabase,
  prisma,
  request,
  seedTenants,
  teardownTenants,
  unique,
  type Tenant,
} from "../../support/parity-db";

const root = path.resolve(__dirname, "../../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);

  return fs.readFileSync(full, "utf-8");
};

describe("Checkpoint 4i — Reports Page", () => {
  let t: Tenant;

  beforeAll(async () => {
    if (hasDatabase) {
      t = await seedTenants();
    }
  });

  afterAll(async () => {
    if (hasDatabase && t) {
      await teardownTenants(t);
    }
  });

  it("reports page renders with date picker", async () => {
    const pageSrc = read("apps/web/src/pages/ReportsPage.tsx");
    const appSrc = read("apps/web/src/App.tsx");
    const sidebarSrc = read("apps/web/src/components/layout/AppSidebar.tsx");

    // Must import and render DateRangePicker from @dms/ui
    expect(pageSrc).toContain("DateRangePicker");
    expect(pageSrc).toMatch(/<DateRangePicker\b/);

    // Period selector configured with daily, weekly, monthly, yearly
    expect(pageSrc).toContain("Select");
    expect(pageSrc).toContain("daily");
    expect(pageSrc).toContain("weekly");
    expect(pageSrc).toContain("monthly");
    expect(pageSrc).toContain("yearly");

    // Must render Tabs with all three report tabs
    expect(pageSrc).toContain("Tabs");
    expect(pageSrc).toContain('value="salesReport"');
    expect(pageSrc).toContain('value="purchaseReport"');
    expect(pageSrc).toContain('value="inventoryReport"');
    expect(pageSrc).toContain("SalesReportTab");
    expect(pageSrc).toContain("PurchaseReportTab");
    expect(pageSrc).toContain("InventoryReportTab");

    // Route mounted in App.tsx and linked in AppSidebar
    expect(appSrc).toContain('path="/reports"');
    expect(sidebarSrc).toMatch(/title:\s*"Reports"[^}]*to:\s*"\/reports"/);
  });

  it("sales report tab shows sales data", async () => {
    const salesTabSrc = read("apps/web/src/components/reports/SalesReportTab.tsx");

    // Must query sales report API endpoint
    expect(salesTabSrc).toContain("/reports/sales/full?");
    expect(salesTabSrc).toContain("basic");
    expect(salesTabSrc).toContain("byCustomer");
    expect(salesTabSrc).toContain("byProduct");

    // Must display KPI cards
    expect(salesTabSrc).toContain("Total Sales");
    expect(salesTabSrc).toContain("Total Orders");
    expect(salesTabSrc).toContain("Unique Customers");

    // Must render breakdown sections
    expect(salesTabSrc).toContain("Sales by Customer");
    expect(salesTabSrc).toContain("Sales by Product");

    if (hasDatabase && t) {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1).toISOString();
      const end = now.toISOString();

      const res = await request(app)
        .get(`/api/reports/sales/full?startDate=${start}&endDate=${end}`)
        .set(asOrg(t.organizationId));

      expect(res.status).toBe(200);
      expect(res.body.basic).toBeDefined();
      expect(typeof res.body.basic.totalSales).toBe("number");
      expect(typeof res.body.basic.totalOrders).toBe("number");
      expect(Array.isArray(res.body.byCustomer)).toBe(true);
      expect(Array.isArray(res.body.byProduct)).toBe(true);
    }
  });

  it("purchase report tab shows purchase data", async () => {
    const purchaseTabSrc = read("apps/web/src/components/reports/PurchaseReportTab.tsx");

    // Must query purchase report API endpoint
    expect(purchaseTabSrc).toContain("/reports/purchase/full?");
    expect(purchaseTabSrc).toContain("basic");
    expect(purchaseTabSrc).toContain("bySupplier");
    expect(purchaseTabSrc).toContain("byProduct");

    // Must display KPI cards
    expect(purchaseTabSrc).toContain("Total Purchase Amount");
    expect(purchaseTabSrc).toContain("Total Orders");
    expect(purchaseTabSrc).toContain("Unique Suppliers");

    // Must render breakdown sections
    expect(purchaseTabSrc).toContain("Spend by Supplier");
    expect(purchaseTabSrc).toContain("Purchases by Product");

    if (hasDatabase && t) {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1).toISOString();
      const end = now.toISOString();

      const res = await request(app)
        .get(`/api/reports/purchase/full?startDate=${start}&endDate=${end}`)
        .set(asOrg(t.organizationId));

      expect(res.status).toBe(200);
      expect(res.body.basic).toBeDefined();
      expect(typeof res.body.basic.totalPurchaseAmount).toBe("number");
      expect(typeof res.body.basic.totalOrders).toBe("number");
      expect(Array.isArray(res.body.bySupplier)).toBe(true);
      expect(Array.isArray(res.body.byProduct)).toBe(true);
    }
  });

  it("inventory report tab shows inventory data", async () => {
    const invTabSrc = read("apps/web/src/components/reports/InventoryReportTab.tsx");

    // Must query inventory report API endpoint
    expect(invTabSrc).toContain("/reports/inventory/full?");
    expect(invTabSrc).toContain("basic");
    expect(invTabSrc).toContain("movements");
    expect(invTabSrc).toContain("stockValuation");
    expect(invTabSrc).toContain("lowStock");

    // Must display KPI cards
    expect(invTabSrc).toContain("Total Inventory Value");
    expect(invTabSrc).toContain("Total Items in Stock");
    expect(invTabSrc).toContain("Low Stock Items");
    expect(invTabSrc).toContain("Unique Products");

    // Must render valuation and movement audit log sections
    expect(invTabSrc).toContain("Stock Valuation");
    expect(invTabSrc).toContain("Inventory Movements");

    if (hasDatabase && t) {
      const res = await request(app)
        .get("/api/reports/inventory/full")
        .set(asOrg(t.organizationId));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.basic)).toBe(true);
      expect(Array.isArray(res.body.movements)).toBe(true);
      expect(Array.isArray(res.body.lowStock)).toBe(true);
      expect(res.body.stockValuation).toBeDefined();
      expect(typeof res.body.stockValuation.totalValue).toBe("number");
    }
  });

  it("date range picker filters data", async () => {
    const pageSrc = read("apps/web/src/pages/ReportsPage.tsx");

    // Passes startDate and endDate params in query string
    expect(pageSrc).toContain("startDate");
    expect(pageSrc).toContain("endDate");
    expect(pageSrc).toContain("params.set");

    if (hasDatabase && t) {
      // Query with narrow window
      const narrowStart = "2026-06-01T00:00:00.000Z";
      const narrowEnd = "2026-06-02T23:59:59.999Z";

      const resNarrow = await request(app)
        .get(`/api/reports/sales/basic?startDate=${narrowStart}&endDate=${narrowEnd}`)
        .set(asOrg(t.organizationId));

      expect(resNarrow.status).toBe(200);
      expect(typeof resNarrow.body.totalOrders).toBe("number");

      // Query with wide window
      const wideStart = "2025-01-01T00:00:00.000Z";
      const wideEnd = "2027-12-31T23:59:59.999Z";

      const resWide = await request(app)
        .get(`/api/reports/sales/basic?startDate=${wideStart}&endDate=${wideEnd}`)
        .set(asOrg(t.organizationId));

      expect(resWide.status).toBe(200);
      expect(resWide.body.totalOrders).toBeGreaterThanOrEqual(resNarrow.body.totalOrders);
    }
  });

  it("charts render with data", async () => {
    const salesTabSrc = read("apps/web/src/components/reports/SalesReportTab.tsx");
    const purchaseTabSrc = read("apps/web/src/components/reports/PurchaseReportTab.tsx");

    // ResponsiveContainer and AreaChart rendered
    expect(salesTabSrc).toContain("ResponsiveContainer");
    expect(salesTabSrc).toContain("AreaChart");
    expect(salesTabSrc).toContain("XAxis");
    expect(salesTabSrc).toContain("YAxis");
    expect(salesTabSrc).toContain("Tooltip");
    expect(salesTabSrc).toContain("No sales data available");

    expect(purchaseTabSrc).toContain("ResponsiveContainer");
    expect(purchaseTabSrc).toContain("AreaChart");
    expect(purchaseTabSrc).toContain("XAxis");
    expect(purchaseTabSrc).toContain("YAxis");
    expect(purchaseTabSrc).toContain("Tooltip");
    expect(purchaseTabSrc).toContain("No purchase data available");

    // Legacy unbacked field names check across apps/web/src
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
      "Legacy invoiceNumber and purchaseOrderNumber must not appear in web source"
    ).toEqual([]);
  });
});
