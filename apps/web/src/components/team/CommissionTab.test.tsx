import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CommissionTab } from "./CommissionTab";

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
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const mockSummary = {
  salesmanId: "usr_sales_1",
  totalInvoices: 2,
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

const mockMembers = [
  {
    id: "mem_1",
    role: "member",
    user: { id: "usr_sales_1", name: "David Salesman", email: "david@example.com" },
  },
  {
    id: "mem_2",
    role: "adminRole",
    user: { id: "usr_admin_1", name: "Alice Admin", email: "alice@example.com" },
  },
];

const renderTab = (props: Partial<React.ComponentProps<typeof CommissionTab>> = {}) =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <CommissionTab members={mockMembers} {...props} />
    </SWRConfig>
  );

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockResolvedValue(mockSummary);
});

describe("CommissionTab", () => {
  it("renders empty state when no salesmen are available", () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <CommissionTab members={[]} />
      </SWRConfig>
    );

    expect(screen.getByText(/no salesmen found/i)).toBeInTheDocument();
  });

  it("displays salesman info, metric cards, and itemized sales breakdown", async () => {
    renderTab();

    expect(await screen.findByText(/commission calculator/i)).toBeInTheDocument();
    expect(await screen.findByText("SAL-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("SAL-2026-0002")).toBeInTheDocument();
    expect(screen.getByText("Apex Beverage Mart")).toBeInTheDocument();
    expect(screen.getByText("Corner Store")).toBeInTheDocument();

    // Check KPI cards
    expect(screen.getByText(/total packs sold/i)).toBeInTheDocument();
    expect(screen.getByText("150 packs")).toBeInTheDocument();
    expect(screen.getAllByText(/completed invoices/i).length).toBeGreaterThan(0);
  });

  it("calculates Total Packs × Rate = Commission Due dynamically", async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByText("SAL-2026-0001");

    const rateInput = screen.getByLabelText(/commission rate per pack/i);
    expect(rateInput).toHaveValue(1);

    // Initial default rate is 1.00 -> 150 packs * 1 = 150.00
    // Change rate to 2.5
    await user.clear(rateInput);
    await user.type(rateInput, "2.5");

    // 150 * 2.5 = 375
    await waitFor(() => {
      expect(screen.getAllByText(/375/).length).toBeGreaterThan(0);
    });
  });

  it("triggers window.print when Print Summary button is clicked", async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    renderTab();
    await screen.findByText("SAL-2026-0001");

    const printBtn = screen.getByRole("button", { name: /print summary/i });
    await user.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
