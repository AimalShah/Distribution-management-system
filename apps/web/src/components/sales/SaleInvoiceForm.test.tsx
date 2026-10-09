import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { SaleInvoiceForm } from "./SaleInvoiceForm";

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../lib/api", () => ({
  fetcher: apiGet,
  api: { get: apiGet, post: apiPost, put: vi.fn(), delete: vi.fn() },
  toFailure: (err: any, fallback: string) => {
    if (err?.code) {
      return {
        origin: "server",
        status: 409,
        code: err.code,
        details: err.details,
        message: err.message || fallback,
      };
    }
    return {
      origin: "server",
      status: 400,
      code: null,
      details: undefined,
      message: err?.message || fallback,
    };
  },
  shortfallLine: () => "",
  failureMessage: (_err: { message?: string }, fallback: string) => _err?.message ?? fallback,
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

const mockCustomers = [
  { id: "cus_1", name: "Acme Retail", creditLimit: 1000 },
];

const mockProducts = [
  { id: "prod_1", name: "Widget", unit: "pcs", unitPrice: 200, unitCost: 150 },
];

const getInitialData = () => ({
  customerId: "cus_1",
  saleCode: "SALE-2026-00001",
  saleDate: "2026-10-10",
  status: "Pending",
  invoiceType: "regular",
  isInterState: false,
  items: [
    { productId: "prod_1", quantity: 2, unitPrice: 200, taxPercent: 0 },
  ],
});

const renderComponent = () =>
  render(
    <MemoryRouter>
      <SWRConfig value={{ provider: () => new Map() }}>
        <SaleInvoiceForm initialData={getInitialData()} />
      </SWRConfig>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockImplementation((url: string) => {
    if (url.startsWith("/customers")) return Promise.resolve({ data: mockCustomers });
    if (url.startsWith("/products")) return Promise.resolve({ data: mockProducts });
    return Promise.resolve({});
  });
});

describe("SaleInvoiceForm Credit Limit Warning (issue #49)", () => {
  it("warns with current outstanding, limit, and projected balance on over-limit sale, then allows override", async () => {
    const user = userEvent.setup();

    // Mock initial submit rejection with CREDIT_LIMIT_EXCEEDED
    apiPost.mockRejectedValueOnce({
      code: "CREDIT_LIMIT_EXCEEDED",
      message: "This sale would take the customer over their credit limit",
      details: {
        outstanding: 800,
        limit: 1000,
        projected: 1200,
      },
    });

    // Mock override submit success
    apiPost.mockResolvedValueOnce({ id: "sale_new" });

    renderComponent();

    // Wait for customer and product data to load
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/customers?page=1&pageSize=100");
      expect(apiGet).toHaveBeenCalledWith("/products?page=1&pageSize=100");
    });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /create sale invoice/i });
    await user.click(submitBtn);

    // Warning dialog should appear
    expect(await screen.findByText("Credit Limit Warning")).toBeInTheDocument();
    const warningDetails = screen.getByTestId("credit-limit-warning-details");
    expect(warningDetails).toHaveTextContent("Rs 800");
    expect(warningDetails).toHaveTextContent("Rs 1,000");
    expect(warningDetails).toHaveTextContent("Rs 1,200");

    // Click Override & Proceed
    const overrideBtn = screen.getByRole("button", { name: /override & proceed/i });
    await user.click(overrideBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/sales",
        expect.objectContaining({ overrideCreditLimit: true })
      );
    });
  });

  it("surfaces a clear message when user is blocked without override permission", async () => {
    const user = userEvent.setup();

    // Mock initial submit rejection
    apiPost.mockRejectedValueOnce({
      code: "CREDIT_LIMIT_EXCEEDED",
      message: "This sale would take the customer over their credit limit",
      details: {
        outstanding: 800,
        limit: 1000,
        projected: 1200,
      },
    });

    // Mock override failure with 403 CREDIT_LIMIT_OVERRIDE_FORBIDDEN
    apiPost.mockRejectedValueOnce({
      code: "CREDIT_LIMIT_OVERRIDE_FORBIDDEN",
      message: "You do not have permission to override a customer's credit limit",
    });

    renderComponent();

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/customers?page=1&pageSize=100");
      expect(apiGet).toHaveBeenCalledWith("/products?page=1&pageSize=100");
    });

    const submitBtn = screen.getByRole("button", { name: /create sale invoice/i });
    await user.click(submitBtn);

    expect(await screen.findByText("Credit Limit Warning")).toBeInTheDocument();

    const overrideBtn = screen.getByRole("button", { name: /override & proceed/i });
    await user.click(overrideBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/sales",
        expect.objectContaining({ overrideCreditLimit: true })
      );
      expect(toast.error).toHaveBeenCalledWith(
        "You do not have permission to override a customer's credit limit"
      );
    });
  });
});
