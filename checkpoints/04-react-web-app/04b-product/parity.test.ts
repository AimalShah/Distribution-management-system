// @vitest-environment jsdom
/**
 * Checkpoint 4b — Product Pages: Parity Test
 *
 * The list, the shared new/edit form, and delete, rendered through SWR and a
 * router with the API answered by path (`renderWithApp`). Writes go through
 * the real axios instance with its methods spied, so a test asserts the exact
 * request body the server will validate -- `category`/`brand` ids and numeric
 * money, which is what `ProductSchema` accepts -- rather than a form state.
 *
 * The original stub was six empty `it` blocks.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductList from "../../../apps/web/src/pages/products/ProductList";
import ProductForm from "../../../apps/web/src/pages/products/ProductForm";
import { api } from "../../../apps/web/src/lib/api";
import { renderWithApp } from "../../../apps/web/src/test/render";
import type { Product } from "../../../apps/web/src/types/catalog";

const category = { id: "cat_1", name: "Beverages", description: null };
const brand = { id: "brd_1", name: "Aqua", categoryId: "cat_1", description: null };

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "prd_1",
  productCode: "SKU-001",
  name: "Mineral Water 1.5L",
  description: null,
  categoryId: category.id,
  brandId: brand.id,
  unit: "pcs",
  unitCost: 10,
  unitPrice: 20,
  isActive: true,
  category,
  brand,
  inventory: { quantityOnHand: 42, reorderLevel: 5 },
  ...overrides,
});

const page = <T>(data: T[], pageCount = 1) => ({ data, pageCount, total: data.length });

const optionResponses = {
  "/categories": page([category]),
  "/brands": page([brand]),
};

beforeEach(() => {
  vi.spyOn(api, "post").mockResolvedValue({ data: { id: "new" } });
  vi.spyOn(api, "put").mockResolvedValue({ data: {} });
  vi.spyOn(api, "delete").mockResolvedValue({ data: undefined });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Checkpoint 4b — product list", () => {
  it("product list renders with pagination", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(ProductList), {
      responses: {
        "/products": (key: string) =>
          key.includes("page=2")
            ? page([product({ id: "prd_2", name: "Orange Juice" })], 2)
            : page([product()], 2),
      },
    });

    expect(await screen.findByText("Mineral Water 1.5L")).toBeTruthy();
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(calls).toContain("/products?page=1&pageSize=20");

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Orange Juice")).toBeTruthy();
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    expect(calls).toContain("/products?page=2&pageSize=20");
  });

  it("product table shows all columns", async () => {
    renderWithApp(createElement(ProductList), { responses: { "/products": page([product()]) } });

    await screen.findByText("Mineral Water 1.5L");
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Code", "Name", "Category", "Brand", "Unit", "Cost", "Price", "Stock", "Status", "Actions"]);

    const row = screen.getByText("SKU-001").closest("tr")!;
    const cells = within(row).getAllByRole("cell").map((c) => c.textContent);
    expect(cells.slice(0, 9)).toEqual([
      "SKU-001",
      "Mineral Water 1.5L",
      "Beverages",
      "Aqua",
      "pcs",
      "$10.00",
      "$20.00",
      "42",
      "Active",
    ]);
  });

  it("searches on the server and starts again from page 1", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(ProductList), {
      responses: { "/products": page([product()]) },
    });
    await screen.findByText("Mineral Water 1.5L");

    await user.type(screen.getByRole("searchbox"), "water");

    await waitFor(() => expect(calls).toContain("/products?page=1&pageSize=20&search=water"));
  });

  it("shows an empty state instead of an empty table", async () => {
    renderWithApp(createElement(ProductList), { responses: { "/products": page([]) } });

    expect(await screen.findByText("No products yet.")).toBeTruthy();
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
  });

  it("delete product removes from list", async () => {
    const user = userEvent.setup();
    let deleted = false;
    renderWithApp(createElement(ProductList), {
      responses: { "/products": () => (deleted ? page([]) : page([product()])) },
    });
    vi.mocked(api.delete).mockImplementation(async () => {
      deleted = true;
      return { data: undefined };
    });

    await user.click(await screen.findByRole("button", { name: "Delete Mineral Water 1.5L" }));
    // Nothing is deleted until the dialog is confirmed.
    expect(api.delete).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(api.delete).toHaveBeenCalledWith("/products/prd_1");
    expect(await screen.findByText("No products yet.")).toBeTruthy();
    expect(screen.queryByText("Mineral Water 1.5L")).toBeNull();
  });
});

describe("Checkpoint 4b — product form", () => {
  it("product form validates required fields", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(ProductForm), { responses: optionResponses });

    await user.click(await screen.findByRole("button", { name: "Create product" }));

    expect(await screen.findByText("Product name must be at least 2 characters")).toBeTruthy();
    expect(screen.getByText("Product code must be at least 3 characters")).toBeTruthy();
    expect(screen.getByText("Please select a category")).toBeTruthy();
    expect(screen.getByText("Please select a unit")).toBeTruthy();
    expect(screen.getByText("Unit cost is required")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("product form submits correctly", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(ProductForm), {
      responses: optionResponses,
      path: "/product/new",
      route: "/product/new",
    });

    await user.type(await screen.findByLabelText("Product name"), "Orange Juice");
    await user.type(screen.getByLabelText("Product code"), "SKU-002");
    await user.selectOptions(await screen.findByLabelText("Category"), "cat_1");
    // Brands are fetched for the chosen category only.
    await waitFor(() => expect(calls).toContain("/brands?pageSize=100&categoryId=cat_1"));
    await user.selectOptions(await screen.findByLabelText("Brand"), await screen.findByRole("option", { name: "Aqua" }));
    await user.selectOptions(screen.getByLabelText("Unit"), "box");
    await user.type(screen.getByLabelText("Unit cost"), "12.5");
    await user.type(screen.getByLabelText("Unit price"), "18");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith("/products", {
      name: "Orange Juice",
      productCode: "SKU-002",
      category: "cat_1",
      brand: "brd_1",
      unit: "box",
      description: "",
      unitCost: 12.5,
      unitPrice: 18,
      isActive: true,
    });
    expect(await screen.findByTestId("navigated-away")).toBeTruthy();
  });

  it("shows the server's message when the write is refused", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValue(
      Object.assign(new Error("Request failed"), {
        response: { data: { message: "A product with this code already exists." } },
      })
    );
    renderWithApp(createElement(ProductForm), { responses: optionResponses, path: "/product/new", route: "/product/new" });

    await user.type(await screen.findByLabelText("Product name"), "Dup");
    await user.type(screen.getByLabelText("Product code"), "SKU-001");
    await user.selectOptions(await screen.findByLabelText("Category"), "cat_1");
    await user.selectOptions(await screen.findByLabelText("Brand"), await screen.findByRole("option", { name: "Aqua" }));
    await user.selectOptions(screen.getByLabelText("Unit"), "pcs");
    await user.type(screen.getByLabelText("Unit cost"), "1");
    await user.type(screen.getByLabelText("Unit price"), "2");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    // Still on the form: a refused write must not navigate away.
    expect(screen.queryByTestId("navigated-away")).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>("Product code").value).toBe("SKU-001");
  });

  it("edit product loads data into form", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(ProductForm), {
      responses: { ...optionResponses, "/products/prd_1": product() },
      path: "/product/prd_1/edit",
      route: "/product/:id/edit",
    });

    const name = await screen.findByLabelText<HTMLInputElement>("Product name");
    expect(name.value).toBe("Mineral Water 1.5L");
    expect(screen.getByLabelText<HTMLInputElement>("Product code").value).toBe("SKU-001");
    expect(screen.getByLabelText<HTMLInputElement>("Unit cost").value).toBe("10");
    await waitFor(() => expect(screen.getByLabelText<HTMLSelectElement>("Category").value).toBe("cat_1"));
    // Set before the brand options loaded, and still shown once they have.
    await waitFor(() => expect(screen.getByLabelText<HTMLSelectElement>("Brand").value).toBe("brd_1"));

    await user.clear(name);
    await user.type(name, "Mineral Water 2L");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith(
      "/products/prd_1",
      expect.objectContaining({ name: "Mineral Water 2L", category: "cat_1", brand: "brd_1", unitCost: 10 })
    );
    expect(api.post).not.toHaveBeenCalled();
  });
});
