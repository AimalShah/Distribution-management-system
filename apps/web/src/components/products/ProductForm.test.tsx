import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductForm } from "./ProductForm";

const { api } = vi.hoisted(() => ({
  api: { post: vi.fn(), put: vi.fn(), get: vi.fn() },
}));

vi.mock("../../lib/api", () => ({
  api,
  fetcher: vi.fn().mockImplementation((url: string) => {
    if (url.startsWith("/categories")) {
      return Promise.resolve({ data: [{ id: "cat_1", name: "Beverages" }] });
    }
    if (url.startsWith("/brands")) {
      return Promise.resolve({ data: [{ id: "brand_1", name: "Coca Cola", categoryId: "cat_1" }] });
    }
    return Promise.resolve({ data: [] });
  }),
  failureMessage: (_err: unknown, fallback: string) => fallback,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

const renderForm = (props = {}) =>
  render(
    <MemoryRouter>
      <SWRConfig value={{ provider: () => new Map() }}>
        <ProductForm {...props} />
      </SWRConfig>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.post.mockResolvedValue({ id: "prod_1" });
});

describe("ProductForm Tiered Pricing (issue #52)", () => {
  it("renders inputs for both Retail Price and Wholesale Price", async () => {
    renderForm();

    expect(await screen.findByLabelText(/retail price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/wholesale price/i)).toBeInTheDocument();
  });

  it("submits retailPrice and wholesalePrice in payload", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByLabelText(/retail price/i);

    await user.type(screen.getByLabelText(/product name/i), "Sprite 1.5L");
    await user.type(screen.getByLabelText(/unit cost/i), "60");
    await user.type(screen.getByLabelText(/retail price/i), "90");
    await user.type(screen.getByLabelText(/wholesale price/i), "75");

    // Select category and brand
    const categorySelect = screen.getByRole("combobox", { name: /category/i });
    await user.click(categorySelect);
    const catOption = await screen.findByRole("option", { name: "Beverages" });
    await user.click(catOption);

    const brandSelect = screen.getByRole("combobox", { name: /brand/i });
    await user.click(brandSelect);
    const brandOption = await screen.findByRole("option", { name: "Coca Cola" });
    await user.click(brandOption);

    await user.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({
          name: "Sprite 1.5L",
          unitCost: 60,
          retailPrice: 90,
          wholesalePrice: 75,
        })
      );
    });
  });
});
