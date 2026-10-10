import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerLedgerPage from "./CustomerLedgerPage";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("../lib/api", () => ({
  fetcher: apiGet,
  api: { get: apiGet },
  failureMessage: (_err: unknown, fallback: string) => fallback,
}));

vi.mock("../lib/whatsapp", () => ({
  waLink: () => "https://wa.me/000",
}));

const ledger = {
  customer: { id: "cus_1", customerCode: "CUS-001", name: "Acme Retail", phone: "03001234567" },
  from: null,
  to: null,
  openingBalance: 0,
  entries: [
    {
      date: "2026-01-01T00:00:00.000Z",
      type: "invoice",
      reference: "SAL-001",
      description: "Invoice SAL-001",
      debit: 5000,
      credit: 0,
      balance: 5000,
      // Credit term due date (issue #48): sale date + the customer's term.
      dueDate: "2026-01-31T00:00:00.000Z",
    },
    {
      date: "2026-01-05T00:00:00.000Z",
      type: "payment",
      reference: "PAY-001",
      description: "Payment (cash)",
      debit: 0,
      credit: 5000,
      balance: 0,
    },
  ],
  totals: { invoices: 5000, credits: 0, payments: 5000, closingBalance: 0 },
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/customers/cus_1/ledger"]}>
      <Routes>
        <Route path="/customers/:id/ledger" element={<CustomerLedgerPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockResolvedValue(ledger);
});

describe("CustomerLedgerPage (issue #48)", () => {
  it("shows the due date on an invoice entry", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("SAL-001")).toBeInTheDocument();
    });

    // 31 Jan 2026 is the invoice's due date; it must reach the statement.
    expect(screen.getByText(/31 Jan 2026|Jan 31, 2026/)).toBeInTheDocument();
  });

  it("does not show a due date on a payment entry", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("PAY-001")).toBeInTheDocument();
    });

    const paymentRow = screen.getByText("PAY-001").closest("tr");
    expect(paymentRow).not.toHaveTextContent(/due/i);
  });

  it("renders Download PDF and Print action buttons", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /print/i })).toBeInTheDocument();
    });
  });
});
