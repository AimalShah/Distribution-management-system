// @vitest-environment jsdom
/**
 * Checkpoint 4c — Purchase Pages: Parity Test
 *
 * The list, the new-purchase form with its dynamic item rows and live totals,
 * and the header-only edit form. Totals come from `calculatePurchaseTotal` in
 * `@dms/shared` -- the same function the server stores -- so the figures
 * asserted here are the ones the API will write.
 *
 * The original stub was six empty `it` blocks.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { calculatePurchaseTotal } from "@dms/shared";
import PurchaseList from "../../../apps/web/src/pages/purchases/PurchaseList";
import PurchaseForm from "../../../apps/web/src/pages/purchases/PurchaseForm";
import PurchaseEdit from "../../../apps/web/src/pages/purchases/PurchaseEdit";
import { api } from "../../../apps/web/src/lib/api";
import { renderWithApp } from "../../../apps/web/src/test/render";

const page = <T>(data: T[], pageCount = 1) => ({ data, pageCount, total: data.length });

const supplier = { id: "sup_1", supplierCode: "SUP-1", companyName: "Acme Beverages", contactPerson: "Ann" };
const products = [
  { id: "prd_1", productCode: "SKU-1", name: "Water", unitCost: 10, unitPrice: 15, isActive: true },
  { id: "prd_2", productCode: "SKU-2", name: "Juice", unitCost: 4, unitPrice: 6, isActive: true },
];

const listRow = (overrides: Record<string, unknown> = {}) => ({
  id: "pur_1",
  purchaseCode: "PO-0001",
  purchaseDate: "2026-10-02T00:00:00.000Z",
  status: "Completed",
  totalAmount: 1234.5,
  supplier,
  _count: { purchaseItems: 3 },
  ...overrides,
});

const formResponses = {
  "/suppliers": page([supplier]),
  "/products": page(products),
};

beforeEach(() => {
  vi.spyOn(api, "post").mockResolvedValue({ data: { id: "pur_new" } });
  vi.spyOn(api, "put").mockResolvedValue({ data: {} });
  vi.spyOn(api, "delete").mockResolvedValue({ data: undefined });
});

afterEach(() => vi.restoreAllMocks());

const renderForm = () =>
  renderWithApp(createElement(PurchaseForm), { responses: formResponses, path: "/purchase/new", route: "/purchase/new" });

describe("Checkpoint 4c — purchase list", () => {
  it("purchase list renders with pagination", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(PurchaseList), {
      responses: {
        "/purchases": (key: string) =>
          key.includes("page=2") ? page([listRow({ id: "pur_2", purchaseCode: "PO-0002" })], 2) : page([listRow()], 2),
      },
    });

    const row = (await screen.findByText("PO-0001")).closest("tr")!;
    expect(within(row).getAllByRole("cell").slice(0, 6).map((c) => c.textContent)).toEqual([
      "PO-0001",
      "Acme Beverages",
      "Oct 02, 2026",
      "Completed",
      "3",
      "$1,234.50",
    ]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("PO-0002")).toBeTruthy();
    expect(calls).toContain("/purchases?page=2&pageSize=20");
  });

  it("deletes only after confirmation, warning that stock is reversed", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(PurchaseList), { responses: { "/purchases": page([listRow()]) } });

    await user.click(await screen.findByRole("button", { name: "Delete PO-0001" }));
    expect(screen.getByRole("dialog").textContent).toContain("taken back out of inventory");
    expect(api.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(api.delete).toHaveBeenCalledWith("/purchases/pur_1");
  });
});

describe("Checkpoint 4c — new purchase form", () => {
  it("prefills a code, today's date and Pending", async () => {
    renderForm();

    expect((await screen.findByLabelText<HTMLInputElement>("Purchase code")).value).toMatch(/^PO-[A-Z0-9]{5}$/);
    expect(screen.getByLabelText<HTMLInputElement>("Purchase date").value).toBe(new Date().toISOString().slice(0, 10));
    expect(screen.getByLabelText<HTMLSelectElement>("Status").value).toBe("Pending");
  });

  it("purchase form validates required fields", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole("button", { name: "Record purchase" }));

    expect(await screen.findByText("Please select a supplier")).toBeTruthy();
    expect(screen.getByText("Please select a product")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("purchase form adds/removes item rows", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByLabelText("Product (item 1)");
    // The only row cannot be removed: a purchase needs at least one line.
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Remove item 1" }).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.click(screen.getByRole("button", { name: "Add item" }));
    expect(screen.getAllByTestId("purchase-item")).toHaveLength(3);

    await user.type(screen.getByLabelText("Quantity (item 2)"), "7");
    await user.click(screen.getByRole("button", { name: "Remove item 1" }));

    expect(screen.getAllByTestId("purchase-item")).toHaveLength(2);
    // The removed row is the first one; the second row's value moved up.
    expect(screen.getByLabelText<HTMLInputElement>("Quantity (item 1)").value).toBe("7");
  });

  it("purchase form calculates totals correctly", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(await screen.findByLabelText("Product (item 1)"), await screen.findByRole("option", { name: "Water (SKU-1)" }));
    // The product's catalogue cost is prefilled.
    expect(screen.getByLabelText<HTMLInputElement>("Unit cost (item 1)").value).toBe("10");
    await user.type(screen.getByLabelText("Quantity (item 1)"), "3");
    await user.type(screen.getByLabelText("Tax % (item 1)"), "10");

    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.selectOptions(screen.getByLabelText("Product (item 2)"), "prd_2");
    await user.type(screen.getByLabelText("Quantity (item 2)"), "5");

    await user.type(screen.getByLabelText("Discount"), "2");
    await user.type(screen.getByLabelText("Additional tax"), "1.5");

    // 3 x 10 + 10% = 33; 5 x 4 = 20; 53 - 2 + 1.5 = 52.5
    const expected = calculatePurchaseTotal({
      items: [
        { quantity: 3, unitCost: 10, taxPercent: 10 },
        { quantity: 5, unitCost: 4 },
      ],
      discount: 2,
      taxAmount: 1.5,
    });
    expect(expected).toBe(52.5);
    const lines = screen.getAllByTestId("line-total").map((el) => el.textContent);
    expect(lines).toEqual(["$33.00", "$20.00"]);
    expect(screen.getByTestId("subtotal").textContent).toBe("$53.00");
    expect(screen.getByTestId("grand-total").textContent).toBe("$52.50");
  });

  it("purchase form submits correctly", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(await screen.findByLabelText("Supplier"), await screen.findByRole("option", { name: "Acme Beverages" }));
    const code = screen.getByLabelText("Purchase code");
    await user.clear(code);
    await user.type(code, "PO-TEST1");
    const date = screen.getByLabelText("Purchase date");
    await user.clear(date);
    await user.type(date, "2026-10-04");
    await user.selectOptions(screen.getByLabelText("Status"), "Completed");
    await user.selectOptions(screen.getByLabelText("Product (item 1)"), await screen.findByRole("option", { name: "Water (SKU-1)" }));
    await user.type(screen.getByLabelText("Quantity (item 1)"), "12");
    await user.type(screen.getByLabelText("Batch (item 1)"), "B-77");
    await user.type(screen.getByLabelText("Expiry (item 1)"), "2027-01-31");
    await user.click(screen.getByRole("button", { name: "Record purchase" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/purchases");
    expect(body).toMatchObject({
      supplierId: "sup_1",
      purchaseCode: "PO-TEST1",
      status: "Completed",
      items: [{ productId: "prd_1", quantity: 12, unitCost: 10, batchNumber: "B-77" }],
    });
    expect((body.purchaseDate as Date).toISOString().slice(0, 10)).toBe("2026-10-04");
    expect(((body.items as { expiryDate: Date }[])[0].expiryDate).toISOString().slice(0, 10)).toBe("2027-01-31");
    // Numbers, not strings: the server's schema is `z.number()`.
    expect(typeof (body.items as { quantity: unknown }[])[0].quantity).toBe("number");
    expect(await screen.findByTestId("navigated-away")).toBeTruthy();
  });
});

describe("Checkpoint 4c — edit purchase", () => {
  const detail = {
    id: "pur_1",
    purchaseCode: "PO-0001",
    purchaseDate: "2026-10-02T00:00:00.000Z",
    status: "Pending",
    supplierId: "sup_1",
    totalAmount: 30,
    discount: 5,
    taxAmount: null,
    supplier,
    purchaseItems: [
      {
        id: "pi_1",
        productId: "prd_1",
        quantity: 3,
        unitCost: 10,
        totalCost: 30,
        batchNumber: "B-1",
        expiryDate: null,
        taxPercent: null,
        discount: null,
        product: { id: "prd_1", name: "Water", productCode: "SKU-1" },
      },
    ],
  };

  it("edit purchase loads data into form", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(PurchaseEdit), {
      responses: { "/purchases/pur_1": detail, "/suppliers": page([supplier]) },
      path: "/purchase/pur_1/edit",
      route: "/purchase/:id/edit",
    });

    expect((await screen.findByLabelText<HTMLInputElement>("Purchase code")).value).toBe("PO-0001");
    expect(screen.getByLabelText<HTMLInputElement>("Purchase date").value).toBe("2026-10-02");
    expect(screen.getByLabelText<HTMLSelectElement>("Status").value).toBe("Pending");
    expect(screen.getByLabelText<HTMLInputElement>("Discount").value).toBe("5");
    await waitFor(() => expect(screen.getByLabelText<HTMLSelectElement>("Supplier").value).toBe("sup_1"));
    // Lines are shown, not editable.
    expect(screen.getByTestId("purchase-lines").textContent).toContain("Water × 3");
    expect(screen.queryByLabelText("Quantity (item 1)")).toBeNull();

    await user.selectOptions(screen.getByLabelText("Status"), "Completed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [path, body] = vi.mocked(api.put).mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/purchases/pur_1");
    expect(body).toMatchObject({ status: "Completed", supplierId: "sup_1", discount: 5 });
    expect(body).not.toHaveProperty("items");
  });
});
