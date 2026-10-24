import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import PaymentsPage from "./PaymentsPage";

const { apiGet, apiDelete, mockInvalidateDomains } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  mockInvalidateDomains: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  fetcher: apiGet,
  api: { get: apiGet, delete: apiDelete, post: vi.fn(), put: vi.fn() },
  failureMessage: (_err: { message?: string }, fallback: string) => _err?.message ?? fallback,
}));

vi.mock("../lib/mutation", () => ({
  invalidateDomains: mockInvalidateDomains,
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const mockPayments = [
  {
    id: "pay-1",
    paymentCode: "PAY-001",
    paidAt: new Date().toISOString(),
    amount: 150,
    method: "Cash",
    notes: "Partial payment",
    saleId: "sale-1",
    customerId: "cust-1",
    customer: { id: "cust-1", name: "Acme Corp", customerCode: "CUST-001" },
    sale: { id: "sale-1", saleCode: "INV-001", totalAmount: 500, amountPaid: 150 },
    deletedAt: null,
  },
];

describe("PaymentsPage — Flag G-3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/payments")) {
        return Promise.resolve({
          data: mockPayments,
          total: 1,
          page: 1,
          pageSize: 20,
        });
      }
      return Promise.resolve({ data: [] });
    });
    apiDelete.mockResolvedValue({ id: "pay-1", deletedAt: new Date().toISOString() });
  });

  it("deleting a payment invokes invalidateDomains('payments') to refresh sales, ledger, and dashboard", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SWRConfig value={{ provider: () => new Map() }}>
          <PaymentsPage />
        </SWRConfig>
      </MemoryRouter>
    );

    // Wait for the payment row to render
    await waitFor(() => {
      expect(screen.getByText("PAY-001")).toBeInTheDocument();
    });

    // Click the delete/reverse button in the table
    const deleteBtn = screen.getByRole("button", { name: "Reverse payment" });
    await user.click(deleteBtn);

    // Confirm dialog appears: click the confirm button inside dialog
    const confirmDialog = await screen.findByRole("dialog");
    const confirmBtn = within(confirmDialog).getByRole("button", { name: "Reverse payment" });
    await user.click(confirmBtn);

    // Assert API delete called
    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/payments/pay-1");
    });

    // CRITICAL: assert invalidateDomains was called for payments domain
    expect(mockInvalidateDomains).toHaveBeenCalledWith("payments");
  });
});
