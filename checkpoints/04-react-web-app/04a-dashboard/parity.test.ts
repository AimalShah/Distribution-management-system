// @vitest-environment jsdom
/**
 * Checkpoint 4a — Dashboard: Parity Test
 *
 * Two halves, because the dashboard is two things:
 *
 * 1. **The screen.** `Dashboard` rendered with SWR and a router, the API
 *    answered by path through `renderWithApp` (apps/web/src/test/render.tsx).
 *    No module mocks: the page asks for `/dashboard/stats` and
 *    `/reports/sales/basic?...` exactly as it does in the browser, so a test
 *    that answers the wrong path fails instead of passing on stale wiring.
 * 2. **The numbers.** `GET /api/dashboard/stats` against a real database. The
 *    legacy computed every figure in the browser from every row the tenant had,
 *    and two of its figures were constants (`12.5`, `-2.3`) and one was
 *    `Math.random()`. The aggregates replacing them are only checkable against
 *    rows that exist.
 *
 * The original stub was eight empty `it` blocks.
 */
import { createElement } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import Dashboard, { salesChartPath } from "../../../apps/web/src/pages/Dashboard";
import { PENDING, renderWithApp } from "../../../apps/web/src/test/render";
import type { DashboardStats } from "../../../apps/web/src/types/dashboard";
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

const stats: DashboardStats = {
  totals: { sales: 12500.5, purchases: 8000, customers: 42, products: 17 },
  trends: { sales: 25, purchases: -10.5 },
  lowStockCount: 3,
  topProducts: [
    { productId: "p1", name: "Mineral Water 1.5L", totalSold: 120, totalRevenue: 2400 },
    { productId: "p2", name: "Orange Juice", totalSold: 80, totalRevenue: 1600 },
  ],
  recentActivities: [
    {
      type: "sale",
      id: "s1",
      code: "INV-0042",
      date: "2026-10-03T00:00:00.000Z",
      amount: 450,
      counterparty: "Corner Store",
    },
    {
      type: "purchase",
      id: "pu1",
      code: "PO-0007",
      date: "2026-10-02T00:00:00.000Z",
      amount: 900,
      counterparty: "Acme Beverages",
    },
  ],
  inventoryLevels: [{ productId: "p1", name: "Mineral Water 1.5L", quantityOnHand: 50, reorderLevel: 10 }],
};

const salesReport = {
  totalSales: 1500,
  dailyTotals: [
    { date: "2026-10-01", total: 1000 },
    { date: "2026-10-02", total: 500 },
  ],
};

const renderDashboard = (responses: Record<string, unknown>) =>
  renderWithApp(createElement(Dashboard), {
    responses: { "/dashboard/stats": stats, "/reports/sales/basic": salesReport, ...responses },
  });

describe("Checkpoint 4a — Dashboard screen", () => {
  it("dashboard page renders without crashing", async () => {
    renderDashboard({});

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
    await screen.findByText("Total Sales");
  });

  it("requests exactly the endpoints it renders", async () => {
    const { calls } = renderDashboard({});

    await screen.findByText("Total Sales");
    expect(calls).toContain("/dashboard/stats");
    expect(calls).toContain(salesChartPath());
  });

  it("stats cards display correct values", async () => {
    renderDashboard({});

    const cards = await screen.findAllByTestId("stat-card");
    expect(cards).toHaveLength(4);
    const text = cards.map((c) => c.textContent);
    expect(text[0]).toContain("$12,500.50");
    expect(text[0]).toContain("+25% from last month");
    expect(text[1]).toContain("$8,000.00");
    expect(text[1]).toContain("10.5% from last month");
    expect(text[2]).toContain("42");
    expect(text[3]).toContain("17");
  });

  it("says so when there is no previous month to compare against", async () => {
    renderDashboard({ "/dashboard/stats": { ...stats, trends: { sales: null, purchases: null } } });

    const cards = await screen.findAllByTestId("stat-card");
    expect(cards[0].textContent).toContain("No sales last month to compare");
    expect(cards[0].textContent).not.toContain("%");
  });

  it("sales chart renders with data", async () => {
    renderDashboard({});

    const chart = await screen.findByTestId("sales-chart");
    expect(within(chart).getByTestId("sales-chart-total").textContent).toBe("$1,500.00");
    expect(within(chart).queryByText("No sales data available")).toBeNull();
  });

  it("sales chart says so when the window is empty", async () => {
    renderDashboard({ "/reports/sales/basic": { totalSales: 0, dailyTotals: [] } });

    const chart = await screen.findByTestId("sales-chart");
    expect(within(chart).getByText("No sales data available")).toBeTruthy();
  });

  it("asks for sales from the first of last month", () => {
    expect(salesChartPath(new Date("2026-01-15T12:00:00Z"))).toBe(
      "/reports/sales/basic?startDate=2025-12-01"
    );
  });

  it("low stock alert shows items below reorder level", async () => {
    renderDashboard({});

    const alert = await screen.findByTestId("low-stock-alert");
    expect(alert.textContent).toContain("3 items need reordering");
    expect(within(alert).getByRole("link", { name: /view inventory/i }).getAttribute("href")).toBe(
      "/inventory"
    );
  });

  it("low stock alert is absent when nothing is low", async () => {
    renderDashboard({ "/dashboard/stats": { ...stats, lowStockCount: 0 } });

    await screen.findByText("Total Sales");
    expect(screen.queryByTestId("low-stock-alert")).toBeNull();
  });

  it("top products list renders correctly", async () => {
    renderDashboard({});

    const list = await screen.findByTestId("top-products");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Mineral Water 1.5L");
    expect(items[0].textContent).toContain("#1");
    expect(items[0].textContent).toContain("120 units sold");
    expect(items[0].textContent).toContain("$2,400.00");
    // The legacy appended a `Math.random()` growth figure to every row.
    expect(list.textContent).not.toMatch(/\+\d+%/);
  });

  it("recent activities feed renders correctly", async () => {
    renderDashboard({});

    const feed = await screen.findByTestId("recent-activities");
    const items = within(feed).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Corner Store");
    expect(items[0].textContent).toContain("Sale");
    expect(items[0].textContent).toContain("INV-0042");
    expect(items[0].textContent).toContain("Oct 03, 2026");
    expect(items[1].textContent).toContain("Acme Beverages");
    expect(items[1].textContent).toContain("Purchase");
  });

  it("loading state shows skeleton", () => {
    renderDashboard({ "/dashboard/stats": PENDING });

    expect(screen.getByTestId("dashboard-skeleton")).toBeTruthy();
    expect(screen.queryByText("Total Sales")).toBeNull();
  });

  it("error state shows error message", async () => {
    const error = Object.assign(new Error("Request failed"), {
      response: { data: { message: "Missing organization context." } },
    });
    renderDashboard({ "/dashboard/stats": error });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Missing organization context.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});

describe.skipIf(!hasDatabase)("Checkpoint 4a — GET /api/dashboard/stats", () => {
  let t: Tenant;
  const now = new Date();
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12));
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 12));

  const sale = (organizationId: string, customerId: string, productId: string, saleDate: Date, amount: number, quantity: number) =>
    prisma.sale.create({
      data: {
        saleCode: unique("INV"),
        organizationId,
        customerId,
        totalAmount: amount,
        status: "Completed",
        saleDate,
        items: { create: { productId, quantity, unitPrice: amount / quantity, totalPrice: amount } },
      },
    });

  beforeAll(async () => {
    t = await seedTenants();
    await sale(t.organizationId, t.customerId, t.productId, thisMonth, 300, 3);
    await sale(t.organizationId, t.customerId, t.productId, lastMonth, 200, 2);
    // The other tenant's sale is larger than both, so leaking it would move
    // every figure below.
    await sale(t.otherOrganizationId, t.otherCustomerId, t.otherProductId, thisMonth, 10_000, 100);
    await prisma.purchase.create({
      data: {
        purchaseCode: unique("PO"),
        organizationId: t.organizationId,
        supplierId: t.supplierId,
        totalAmount: 120,
        status: "Completed",
        purchaseDate: thisMonth,
      },
    });
    await prisma.inventory.create({
      data: { organizationId: t.organizationId, productId: t.productId, quantityOnHand: 4, reorderLevel: 5 },
    });
  });

  afterAll(async () => {
    if (t) await teardownTenants(t);
  });

  it("aggregates only the caller's tenant", async () => {
    const res = await request(app).get("/api/dashboard/stats").set(asOrg(t.organizationId));

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ sales: 500, purchases: 120, customers: 1, products: 1 });
  });

  it("computes the sales trend from this month against last", async () => {
    const res = await request(app).get("/api/dashboard/stats").set(asOrg(t.organizationId));

    // 300 this month against 200 last month.
    expect(res.body.trends.sales).toBe(50);
    // No purchases last month: there is no percentage to report.
    expect(res.body.trends.purchases).toBeNull();
  });

  it("counts low stock with the same rule as GET /inventory/low-stock", async () => {
    const [dashboard, lowStock] = await Promise.all([
      request(app).get("/api/dashboard/stats").set(asOrg(t.organizationId)),
      request(app).get("/api/inventory/low-stock").set(asOrg(t.organizationId)),
    ]);

    expect(dashboard.body.lowStockCount).toBe(1);
    expect(dashboard.body.lowStockCount).toBe(lowStock.body.total);
  });

  it("ranks this month's top products by revenue", async () => {
    const res = await request(app).get("/api/dashboard/stats").set(asOrg(t.organizationId));

    expect(res.body.topProducts).toEqual([
      { productId: t.productId, name: "Parity Product", totalSold: 3, totalRevenue: 300 },
    ]);
  });

  it("merges recent sales and purchases newest first", async () => {
    const res = await request(app).get("/api/dashboard/stats").set(asOrg(t.organizationId));

    const types = res.body.recentActivities.map((a: { type: string }) => a.type);
    expect(types).toHaveLength(3);
    expect(types).toContain("purchase");
    const dates = res.body.recentActivities.map((a: { date: string }) => a.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
