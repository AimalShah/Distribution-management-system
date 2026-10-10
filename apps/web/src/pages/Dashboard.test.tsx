import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";

const { mockFetcher } = vi.hoisted(() => ({ mockFetcher: vi.fn() }));

vi.mock("../lib/api", () => ({
  fetcher: mockFetcher,
  failureMessage: (_err: unknown, fallback: string) => fallback,
}));

vi.mock("../components/dashboard/SalesChart", () => ({
  SalesChart: () => <div data-testid="sales-chart">Sales Chart</div>,
}));

vi.mock("../components/dashboard/InventoryChart", () => ({
  InventoryChart: () => <div data-testid="inventory-chart">Inventory Chart</div>,
}));

vi.mock("../components/dashboard/TopProducts", () => ({
  TopProducts: () => <div data-testid="top-products">Top Products</div>,
}));

vi.mock("../components/dashboard/RecentActivities", () => ({
  RecentActivities: () => <div data-testid="recent-activities">Recent Activities</div>,
}));

describe("Dashboard Operational Cockpit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetcher.mockImplementation((url: string) => {
      if (url === "/dashboard/stats") {
        return Promise.resolve({
          totalProducts: 100,
          totalCustomers: 25,
          totalSuppliers: 10,
          totalSalesAmount: 150000,
          totalPurchasesAmount: 90000,
          lowStockCount: 2,
          expiringSoonCount: 1,
          outstanding: 45000,
          recentSales: [],
          recentPurchases: [],
          topInventory: [],
        });
      }

      if (url.startsWith("/reports/sales/basic")) {
        return Promise.resolve({
          totalSales: 150000,
          totalOrders: 18,
          uniqueCustomers: 12,
          totalQuantity: 240,
          dailyTotals: [],
          byStatus: [],
        });
      }

      if (url.startsWith("/reports/purchase/basic")) {
        return Promise.resolve({
          totalPurchaseAmount: 90000,
          totalOrders: 6,
          totalQuantity: 300,
          dailyTotals: [],
          byStatus: [],
        });
      }

      if (url.startsWith("/inventory/low-stock")) {
        return Promise.resolve({
          data: [
            {
              id: "stock_1",
              quantityOnHand: 0,
              reorderLevel: 10,
              product: { name: "Paracetamol 500mg", productCode: "MED-001" },
            },
          ],
          total: 1,
        });
      }

      if (url.startsWith("/inventory/batches/expiring")) {
        return Promise.resolve([
          {
            id: "batch_1",
            batchNumber: "B-2026-X",
            productId: "prod_1",
            productName: "Amoxicillin 250mg",
            productCode: "MED-002",
            expiryDate: "2026-10-25T00:00:00.000Z",
            daysUntilExpiry: 15,
            isExpired: false,
            quantityRemaining: 40,
          },
        ]);
      }

      if (url === "/reports/sales/aging") {
        return Promise.resolve({
          totalOutstanding: 45000,
          totalOverdue: 22000,
          byCustomer: [
            {
              customerId: "cus_1",
              customerName: "Metro Pharma",
              customerCode: "CUS-001",
              totalOutstanding: 30000,
              totalOverdue: 22000,
              current: 8000,
              buckets: { "0-30": 12000, "31-60": 10000, "61-90": 0, "90+": 0 },
            },
          ],
        });
      }

      return Promise.resolve([]);
    });
  });

  it("renders the operational cockpit header and quick action shortcuts", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("Operational Cockpit")).toBeInTheDocument();
    expect(screen.getByText("New Sale Invoice")).toBeInTheDocument();
    expect(screen.getByText("New Purchase Order")).toBeInTheDocument();
    expect(screen.getByText("Stock Management")).toBeInTheDocument();
    expect(screen.getByText("Customers & Statements")).toBeInTheDocument();
  });

  it("renders alert cards for shortages, expiring batches, and overdue receivables with ledger links", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Stock Shortages")).toBeInTheDocument();
      expect(screen.getByText("Expiring Soon")).toBeInTheDocument();
      expect(screen.getByText("Overdue Receivables")).toBeInTheDocument();
      expect(screen.getByText("Metro Pharma")).toBeInTheDocument();
    });

    const ledgerLink = screen.getByRole("link", { name: /ledger/i });
    expect(ledgerLink).toHaveAttribute("href", "/customers/cus_1/ledger");
  });
});
