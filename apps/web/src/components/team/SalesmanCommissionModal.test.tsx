import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SalesmanCommissionModal } from "./SalesmanCommissionModal";

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

const mockSummary = {
  salesmanId: "usr_sales_1",
  totalInvoices: 3,
  totalPacks: 150,
  totalAmount: 45000,
  sales: [
    {
      id: "sal_1",
      saleCode: "SAL-2026-0001",
      saleDate: "2026-11-01T10:00:00.000Z",
      customerName: "Apex Beverage Mart",
      packs: 50,
      totalAmount: 15000,
    },
    {
      id: "sal_2",
      saleCode: "SAL-2026-0002",
      saleDate: "2026-11-02T11:00:00.000Z",
      customerName: "Corner Store",
      packs: 100,
      totalAmount: 30000,
    },
  ],
};

const renderModal = (props: Partial<React.ComponentProps<typeof SalesmanCommissionModal>> = {}) =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <SalesmanCommissionModal
        open={true}
        onOpenChange={vi.fn()}
        salesman={{ id: "usr_sales_1", name: "David Salesman", email: "david@example.com" }}
        {...props}
      />
    </SWRConfig>
  );

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockResolvedValue(mockSummary);
});

describe("SalesmanCommissionModal (issue #54)", () => {
  it("displays salesman info, metric cards, and itemized sales breakdown", async () => {
    renderModal();

    expect(await screen.findByText(/David Salesman/i)).toBeInTheDocument();
    const packElements = await screen.findAllByText(/150 packs/i);
    expect(packElements.length).toBeGreaterThan(0);
    expect(screen.getByText("Apex Beverage Mart")).toBeInTheDocument();
    expect(screen.getByText("SAL-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Corner Store")).toBeInTheDocument();
  });

  it("calculates Total Packs × Rate = Commission Due dynamically", async () => {
    const user = userEvent.setup();
    renderModal();

    await screen.findAllByText(/150 packs/i);

    const rateInput = screen.getByLabelText(/commission rate per pack/i);
    await user.clear(rateInput);
    await user.type(rateInput, "2.5");

    // 150 packs * 2.5 = 375
    await waitFor(() => {
      expect(screen.getByText(/375/i)).toBeInTheDocument();
    });
  });

  it("refetches summary when date range is changed", async () => {
    const user = userEvent.setup();
    renderModal();

    await screen.findAllByText(/150 packs/i);

    const startInput = screen.getByLabelText(/start date/i);
    await user.type(startInput, "2026-11-01");

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        expect.stringContaining("startDate=2026-11-01")
      );
    });
  });
});
