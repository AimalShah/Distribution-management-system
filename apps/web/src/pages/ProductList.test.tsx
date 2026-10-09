import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ProductList from "./ProductList";

const { apiGet, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  fetcher: apiGet,
  api: { get: apiGet, delete: apiDelete, post: vi.fn(), put: vi.fn() },
  failureMessage: (_err: { message?: string }, fallback: string) => _err?.message ?? fallback,
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const mockProducts = [
  {
    id: "p1",
    name: "Cola 500ml",
    productCode: "COL-500",
    unit: "Bottle",
    unitCost: 50,
    unitPrice: 70,
    isActive: true,
    brandId: "b1",
    brand: { id: "b1", name: "Next Cola" },
  },
  {
    id: "p2",
    name: "Orange Fizz",
    productCode: "ORG-500",
    unit: "Bottle",
    unitCost: 45,
    unitPrice: 65,
    isActive: true,
    brandId: "b2",
    brand: { id: "b2", name: "Fanta" },
  },
];

const mockBrands = [
  { id: "b1", name: "Next Cola", shortCode: "NXC" },
  { id: "b2", name: "Fanta", shortCode: "FNT" },
];

const renderComponent = () =>
  render(
    <MemoryRouter>
      <SWRConfig value={{ provider: () => new Map() }}>
        <ProductList />
      </SWRConfig>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockImplementation((url: string) => {
    if (url.startsWith("/categories")) {
      return Promise.resolve({ data: [] });
    }
    if (url.startsWith("/brands")) {
      return Promise.resolve({ data: mockBrands });
    }
    if (url.startsWith("/products")) {
      return Promise.resolve({ data: mockProducts, total: 2 });
    }
    return Promise.resolve({});
  });
});

describe("ProductList Brand Filter (issue #45)", () => {
  it("renders products and passes brandId query when filter is selected", async () => {
    renderComponent();

    expect(await screen.findByText("Cola 500ml")).toBeInTheDocument();
    expect(screen.getByText("Orange Fizz")).toBeInTheDocument();

    expect(screen.getByTestId("brand-filter")).toBeInTheDocument();
  });

  it("calls products endpoint with brandId filter", async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText("Cola 500ml")).toBeInTheDocument();

    const brandTrigger = screen.getByTestId("brand-filter");
    await user.click(brandTrigger);

    const fantaOption = await screen.findByRole("option", { name: "Fanta" });
    await user.click(fantaOption);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        expect.stringContaining("brandId=b2")
      );
    });
  });
});
