import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AgingReportTab } from "./AgingReportTab";

const { apiGet } = vi.hoisted(() => ({
  apiGet: vi.fn(),
}));

vi.mock("../../lib/api", () => ({
  fetcher: apiGet,
  api: { get: apiGet },
}));

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const mockAgingData = {
  asOfDate: "2026-06-01T00:00:00.000Z",
  totalOutstanding: 1500,
  totalOverdue: 1000,
  current: 500,
  buckets: {
    "0-30": 100,
    "31-60": 200,
    "61-90": 300,
    "90+": 400,
  },
  summary: {
    totalOutstanding: 1500,
    totalOverdue: 1000,
    current: 500,
    buckets: {
      "0-30": 100,
      "31-60": 200,
      "61-90": 300,
      "90+": 400,
    },
  },
  byCustomer: [
    {
      customerId: "cus_1",
      customerName: "Acme Retail",
      customerCode: "C-001",
      totalOutstanding: 1500,
      totalOverdue: 1000,
      current: 500,
      buckets: {
        "0-30": 100,
        "31-60": 200,
        "61-90": 300,
        "90+": 400,
      },
      invoices: [],
    },
  ],
  invoices: [
    {
      id: "sale_1",
      saleCode: "INV-001",
      customerId: "cus_1",
      customerName: "Acme Retail",
      customerCode: "C-001",
      saleDate: "2026-04-10T00:00:00.000Z",
      dueDate: "2026-05-10T00:00:00.000Z",
      totalAmount: 150,
      amountPaid: 50,
      balance: 100,
      daysOverdue: 22,
      bucket: "0-30" as const,
    },
  ],
};

const renderComponent = (queryString = "startDate=2026-01-01&endDate=2026-06-01") =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <AgingReportTab queryString={queryString} />
    </SWRConfig>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AgingReportTab (issue #50, ADR 0009)", () => {
  it("renders KPIs and overdue aging buckets", async () => {
    apiGet.mockResolvedValueOnce(mockAgingData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Overdue Aging Summary")).toBeInTheDocument();
    });

    // Check KPI cards
    expect(screen.getAllByText("Total Outstanding").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Total Overdue")).toBeInTheDocument();
    expect(screen.getByText("Current (Not Due)")).toBeInTheDocument();
    expect(screen.getAllByText("90+ Days Overdue").length).toBeGreaterThanOrEqual(1);

    // Check bucket headers
    expect(screen.getByText("0–30 Days Overdue")).toBeInTheDocument();
    expect(screen.getByText("31–60 Days Overdue")).toBeInTheDocument();
    expect(screen.getByText("61–90 Days Overdue")).toBeInTheDocument();

    // Check customer table row
    expect(screen.getAllByText("Acme Retail").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("C-001")).toBeInTheDocument();

    // Check invoice table row
    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.getByText("22d overdue (0-30)")).toBeInTheDocument();
  });

  it("renders empty state when no receivables exist", async () => {
    apiGet.mockResolvedValueOnce({
      asOfDate: "2026-06-01T00:00:00.000Z",
      totalOutstanding: 0,
      totalOverdue: 0,
      current: 0,
      buckets: { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
      summary: {
        totalOutstanding: 0,
        totalOverdue: 0,
        current: 0,
        buckets: { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
      },
      byCustomer: [],
      invoices: [],
    });

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText("No overdue or outstanding receivables found for the selected scope.")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("No open invoices found.")).toBeInTheDocument();
  });
});
