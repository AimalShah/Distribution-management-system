import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { describe, it, vi, expect, beforeEach, beforeAll } from "vitest";
import PurchaseNew from "../pages/PurchaseNew";

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

vi.mock("../lib/api", () => ({
  fetcher: apiGet,
  api: { get: apiGet, post: apiPost, put: vi.fn(), delete: vi.fn() },
  failureMessage: (err: any, fallback: string) => err?.message ?? fallback,
}));

vi.mock("../lib/auth", () => ({
  useAuth: () => ({ user: { name: "Test User" } }),
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

const mockSuppliers = [
  { id: "sup_1", companyName: "Acme Supplies" },
];

const mockProducts = [
  { id: "prod_1", name: "Widget A", productCode: "WID-A", unitCost: 100, unit: "pcs" },
];

describe("PurchaseNew page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/suppliers")) return Promise.resolve({ data: mockSuppliers });
      if (url.startsWith("/products")) return Promise.resolve({ data: mockProducts });
      return Promise.resolve({});
    });
  });

  it("renders without error and shows products purchased table without line tax/discount columns", async () => {
    render(
      <MemoryRouter>
        <SWRConfig value={{ provider: () => new Map() }}>
          <PurchaseNew />
        </SWRConfig>
      </MemoryRouter>
    );
    expect(screen.getByText("New Purchase Order")).toBeInTheDocument();
    expect(screen.getByText("Order code")).toBeInTheDocument();
    expect(screen.getByText("Products purchased")).toBeInTheDocument();
    expect(screen.getAllByText("Cost per unit *").length).toBeGreaterThan(0);
    expect(screen.queryByText("Tax %")).not.toBeInTheDocument();
    expect(screen.queryByText("Discount (per item)")).not.toBeInTheDocument();
    expect(screen.getByText("Tax (calculated automatically)")).toBeInTheDocument();
    expect(screen.getByText("Discount (whole order)")).toBeInTheDocument();
  });
});
